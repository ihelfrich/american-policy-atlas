// Atlas research-assistant Worker.
//
// Contract: POST { question, context } where `context` is an array of
// { title, text, url } passages the static site already retrieved client-side
// (the corpus is ~40 chunks, so retrieval is cheap and runs in the browser).
// The Worker's only job is grounded generation — it never sees an API key on
// the client side, and it refuses to answer outside the supplied context.
//
// Primary inference: Cloudflare Workers AI (free tier). If GROQ_API_KEY is set
// as a secret, that path is used as a fallback when Workers AI errors.

const MODEL = "@cf/meta/llama-3.1-8b-instruct";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const MAX_CONTEXT = 8;

const SYSTEM = `You are the research assistant for the American Policy Atlas, a teaching observatory for statistics built on every U.S. county.
Answer ONLY from the CONTEXT passages provided. The context is the atlas's own module text, live statistics, and reading-room papers.
Rules:
- If the context does not contain the answer, say so plainly and suggest which section of the atlas might help. Do not invent statistics, citations, author names, or DOIs.
- Be concise and precise. Prefer the exact numbers in the context over vague language.
- When you use a passage, you may name its section (e.g. "the Spatial dependence module").
- You are teaching statistics to a curious reader. Explain intuitively, then precisely.
- Never claim causation where the atlas describes association.`;

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function buildPrompt(question, context) {
  const ctx = (context || []).slice(0, MAX_CONTEXT).map((c, i) =>
    `[${i + 1}] ${c.title || "passage"}\n${c.text}`).join("\n\n");
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: `CONTEXT:\n${ctx || "(no passages retrieved)"}\n\nQUESTION: ${question}\n\nAnswer from the context above.` },
  ];
}

// Stream Workers AI's SSE through unchanged (it already emits text/event-stream).
async function runWorkersAI(env, messages) {
  return env.AI.run(MODEL, { messages, stream: true, max_tokens: 700 });
}

// Groq fallback: re-shape its OpenAI-style SSE into the same {response: "..."}
// event payload the client expects from Workers AI.
async function runGroq(key, messages) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: GROQ_MODEL, messages, stream: true, max_tokens: 700 }),
  });
  if (!r.ok || !r.body) throw new Error(`groq ${r.status}`);
  const reader = r.body.getReader();
  const dec = new TextDecoder(), enc = new TextEncoder();
  let buf = "";
  return new ReadableStream({
    async pull(ctrl) {
      const { done, value } = await reader.read();
      if (done) { ctrl.enqueue(enc.encode("data: [DONE]\n\n")); ctrl.close(); return; }
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const data = t.slice(5).trim();
        if (data === "[DONE]") { ctrl.enqueue(enc.encode("data: [DONE]\n\n")); continue; }
        try {
          const tok = JSON.parse(data).choices?.[0]?.delta?.content;
          if (tok) ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ response: tok })}\n\n`));
        } catch { /* keep-alive / partial */ }
      }
    },
  });
}

export default {
  async fetch(req, env) {
    const origin = env.ALLOWED_ORIGIN || req.headers.get("Origin") || "*";
    const headers = cors(origin);

    if (req.method === "OPTIONS") return new Response(null, { headers });
    if (req.method === "GET")
      return new Response(JSON.stringify({ ok: true, service: "atlas-assistant" }),
        { headers: { ...headers, "Content-Type": "application/json" } });
    if (req.method !== "POST")
      return new Response("Method not allowed", { status: 405, headers });

    let body;
    try { body = await req.json(); } catch { return json({ error: "bad JSON" }, 400, headers); }
    const question = (body.question || "").toString().slice(0, 2000).trim();
    if (!question) return json({ error: "missing question" }, 400, headers);
    const messages = buildPrompt(question, body.context);

    let stream;
    try {
      stream = await runWorkersAI(env, messages);
    } catch (e) {
      if (env.GROQ_API_KEY) {
        try { stream = await runGroq(env.GROQ_API_KEY, messages); }
        catch (e2) { return json({ error: "inference unavailable", detail: String(e2) }, 502, headers); }
      } else {
        return json({ error: "inference unavailable", detail: String(e) }, 502, headers);
      }
    }
    return new Response(stream, {
      headers: { ...headers, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  },
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...headers, "Content-Type": "application/json" },
  });
}
