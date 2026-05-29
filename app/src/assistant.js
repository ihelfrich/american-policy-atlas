// Research-assistant panel: a collapsible right-drawer that answers questions
// grounded in the atlas's own corpus.
//
// Two layers, degrading gracefully:
//   1. Always-on: client-side retrieval over app/public/data/corpus.json
//      (TF-IDF cosine, ~40 chunks). With no backend it shows the matching
//      passages directly — the site stays useful on bare GitHub Pages.
//   2. Optional: if an endpoint is configured (VITE_ASSISTANT_ENDPOINT or the
//      gear-icon override in localStorage), the retrieved passages are sent to
//      the Cloudflare Worker, which streams a grounded generated answer.
import { loadJSON } from "./data.js";

const ENDPOINT_KEY = "atlasAssistantEndpoint";
const STOP = new Set(("the a an and or of to in on for with is are was were be been being this that these those it its as at by from into about over under between not no can could would should may might will than then so such " +
  "what which who whom whose how why when where does do did done doing has have had get gets got find finds show shows tell explain mean means use used using " +
  "you your we our they their he she his her i me my " +
  "but if while because does't dont doesnt just also more most some any all each both " +
  "atlas").split(/\s+/));

function getEndpoint() {
  return (localStorage.getItem(ENDPOINT_KEY) || import.meta.env.VITE_ASSISTANT_ENDPOINT || "").trim();
}

const tokenize = (s) =>
  (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 2 && !STOP.has(t));

// Build a TF-IDF index over the corpus once.
function buildIndex(chunks) {
  const df = new Map();
  const docs = chunks.map((c) => {
    const toks = tokenize(`${c.title} ${c.text}`);
    const tf = new Map();
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    return { tf, len: toks.length || 1 };
  });
  const N = chunks.length;
  const idf = (t) => Math.log((N + 1) / ((df.get(t) || 0) + 1)) + 1;
  const vecs = docs.map(({ tf, len }) => {
    const v = new Map();
    let norm = 0;
    for (const [t, c] of tf) { const w = (c / len) * idf(t); v.set(t, w); norm += w * w; }
    norm = Math.sqrt(norm) || 1;
    return { v, norm };
  });
  return { idf, vecs };
}

function retrieve(query, chunks, index, k = 5) {
  const qt = tokenize(query);
  if (!qt.length) return [];
  const qv = new Map();
  let qnorm = 0;
  const tf = new Map();
  for (const t of qt) tf.set(t, (tf.get(t) || 0) + 1);
  for (const [t, c] of tf) { const w = (c / qt.length) * index.idf(t); qv.set(t, w); qnorm += w * w; }
  qnorm = Math.sqrt(qnorm) || 1;
  const scored = chunks.map((c, i) => {
    const { v, norm } = index.vecs[i];
    let dot = 0;
    for (const [t, w] of qv) { const dw = v.get(t); if (dw) dot += w * dw; }
    return { c, score: dot / (qnorm * norm) };
  });
  return scored.filter((s) => s.score > 0.02).sort((a, b) => b.score - a.score).slice(0, k).map((s) => s.c);
}

const STARTERS = [
  "What is Moran's I and what does the atlas find?",
  "Explain a confidence interval using the diabetes data.",
  "Why does the income slope shrink when poverty is added?",
  "What is empirical-Bayes shrinkage for?",
];

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Minimal, safe inline markdown: **bold**, `code`, paragraph breaks.
function mdInline(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br/>");
}

export async function mountAssistant() {
  let corpus;
  try { corpus = await loadJSON("corpus.json"); }
  catch { return; } // no corpus -> no panel; the rest of the site is unaffected
  const chunks = corpus.chunks || [];
  if (!chunks.length) return;
  const index = buildIndex(chunks);

  const root = document.createElement("div");
  root.id = "assistant";
  root.innerHTML = `
    <button id="asst-toggle" class="asst-toggle" aria-label="Open research assistant" title="Ask the atlas">
      <span class="asst-toggle-dot"></span>Ask the atlas
    </button>
    <aside id="asst-drawer" class="asst-drawer" aria-hidden="true">
      <header class="asst-head">
        <div><div class="asst-title">Research assistant</div>
          <div class="asst-sub" id="asst-mode"></div></div>
        <div class="asst-head-btns">
          <button id="asst-gear" class="asst-icon" title="Set generation endpoint" aria-label="Settings">⚙</button>
          <button id="asst-close" class="asst-icon" title="Close" aria-label="Close">✕</button>
        </div>
      </header>
      <div id="asst-settings" class="asst-settings" hidden>
        <label class="asst-set-label">Worker endpoint (optional — enables generated answers)</label>
        <input id="asst-endpoint" class="asst-input" type="url" placeholder="https://atlas-assistant.<you>.workers.dev" />
        <div class="asst-set-row">
          <button id="asst-save" class="asst-btn-sm">Save</button>
          <span class="asst-set-note">Leave blank for passage-only mode. Stored locally.</span>
        </div>
      </div>
      <div id="asst-log" class="asst-log"></div>
      <div class="asst-starters" id="asst-starters"></div>
      <form id="asst-form" class="asst-form">
        <input id="asst-q" class="asst-input" autocomplete="off" placeholder="Ask about a method, a number, a paper…" />
        <button type="submit" class="asst-send" aria-label="Send">→</button>
      </form>
      <div class="asst-foot">Grounded in this atlas only · ${chunks.length} passages · answers can be imperfect — check the cited sections.</div>
    </aside>`;
  document.body.appendChild(root);

  const drawer = root.querySelector("#asst-drawer");
  const toggle = root.querySelector("#asst-toggle");
  const log = root.querySelector("#asst-log");
  const form = root.querySelector("#asst-form");
  const qinput = root.querySelector("#asst-q");
  const modeEl = root.querySelector("#asst-mode");
  const settings = root.querySelector("#asst-settings");
  const epInput = root.querySelector("#asst-endpoint");
  const starters = root.querySelector("#asst-starters");

  function refreshMode() {
    const ep = getEndpoint();
    modeEl.textContent = ep ? "generated answers · grounded" : "passage mode · grounded";
    epInput.value = localStorage.getItem(ENDPOINT_KEY) || "";
  }
  refreshMode();

  starters.innerHTML = STARTERS.map((s) => `<button class="asst-chip">${esc(s)}</button>`).join("");
  starters.addEventListener("click", (e) => {
    const b = e.target.closest(".asst-chip"); if (!b) return;
    qinput.value = b.textContent; form.requestSubmit();
  });

  const open = () => { drawer.setAttribute("aria-hidden", "false"); drawer.classList.add("open"); toggle.classList.add("hidden"); setTimeout(() => qinput.focus(), 80); };
  const close = () => { drawer.setAttribute("aria-hidden", "true"); drawer.classList.remove("open"); toggle.classList.remove("hidden"); };
  toggle.addEventListener("click", open);
  root.querySelector("#asst-close").addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawer.classList.contains("open")) close(); });

  root.querySelector("#asst-gear").addEventListener("click", () => { settings.hidden = !settings.hidden; });
  root.querySelector("#asst-save").addEventListener("click", () => {
    const val = epInput.value.trim();
    if (val) localStorage.setItem(ENDPOINT_KEY, val); else localStorage.removeItem(ENDPOINT_KEY);
    settings.hidden = true; refreshMode();
    addMsg("system", val ? "Generated answers enabled." : "Switched to passage mode.");
  });

  function addMsg(who, html) {
    const el = document.createElement("div");
    el.className = `asst-msg asst-${who}`;
    el.innerHTML = html;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function citations(cites) {
    if (!cites.length) return "";
    const items = cites.map((c) => {
      const label = `${esc(c.section)} — ${esc(c.title)}`;
      return c.url
        ? `<a href="${esc(c.url)}" ${c.url.startsWith("#") ? "" : 'target="_blank" rel="noopener"'}>${label}</a>`
        : `<span>${label}</span>`;
    }).join("");
    return `<div class="asst-cites"><div class="asst-cites-h">Sources</div>${items}</div>`;
  }

  async function ask(question) {
    starters.style.display = "none";
    addMsg("user", esc(question));
    const hits = retrieve(question, chunks, index);
    if (!hits.length) {
      addMsg("bot", `<p>I couldn't find anything in the atlas for that. Try a statistics term (regression, Moran's I, shrinkage), a variable (income, poverty, diabetes), or the redlining story.</p>`);
      return;
    }
    const ep = getEndpoint();
    if (!ep) {
      // Passage mode: present the best matches directly.
      const body = hits.slice(0, 3).map((c) =>
        `<p><b>${esc(c.title)}</b><br/>${esc(c.text)}</p>`).join("");
      addMsg("bot", `<div class="asst-passages">${body}</div>` + citations(hits.slice(0, 3)));
      return;
    }
    // Generated mode: stream from the Worker.
    const bot = addMsg("bot", `<span class="asst-typing">▍</span>`);
    let acc = "";
    try {
      const res = await fetch(ep, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context: hits.map((c) => ({ title: `${c.section} — ${c.title}`, text: c.text, url: c.url })) }),
      });
      if (!res.ok || !res.body) throw new Error(`endpoint ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop();
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const data = t.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const tok = JSON.parse(data).response;
            if (tok) { acc += tok; bot.innerHTML = `<p>${mdInline(acc)}</p><span class="asst-typing">▍</span>`; log.scrollTop = log.scrollHeight; }
          } catch { /* partial */ }
        }
      }
      bot.innerHTML = `<p>${mdInline(acc.trim() || "(no answer)")}</p>` + citations(hits.slice(0, 3));
    } catch (err) {
      // Worker unreachable -> fall back to passage mode for this question.
      const body = hits.slice(0, 3).map((c) => `<p><b>${esc(c.title)}</b><br/>${esc(c.text)}</p>`).join("");
      bot.innerHTML = `<div class="asst-note">Generation endpoint unavailable — showing the matching passages instead.</div><div class="asst-passages">${body}</div>` + citations(hits.slice(0, 3));
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = qinput.value.trim();
    if (!q) return;
    qinput.value = "";
    ask(q);
  });
}
