// Minimal hash router. Knows nothing about content: it is handed a list of
// pages (each {id, route, title, html, mount}) and a single <main> view node,
// renders exactly one page at a time, and runs that page's mount() after the
// markup is in the DOM. One page in the document at a time is the whole point —
// it is what lets each chapter own a single MapLibre canvas without leaking
// WebGL contexts, and it is why this is a *curriculum*, not an endless scroll.

function normalize(hash) {
  const h = (hash || "").replace(/^#/, "");
  if (!h || h === "/") return "/";
  return h.startsWith("/") ? h : "/" + h;
}

export function startRouter({ view, pages, fallback = "/", onBeforeRender, onAfterRender }) {
  const byRoute = new Map(pages.map((p) => [p.route, p]));

  function resolve() {
    const route = normalize(location.hash);
    return byRoute.get(route) || byRoute.get(fallback) || pages[0];
  }

  function render() {
    const page = resolve();
    onBeforeRender?.(page);              // teardown hook (maps, observers)
    view.innerHTML = page.html || "";
    document.title = page.title
      ? `${page.title} · The American Policy Atlas`
      : "The American Policy Atlas";
    // Jump to top on navigation; a curriculum page should start at its title,
    // not wherever the previous page happened to be scrolled.
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    try { page.mount?.(); } catch (e) { console.error(`mount failed for ${page.id}`, e); }
    onAfterRender?.(page);               // nav highlight, reveal animations
  }

  window.addEventListener("hashchange", render);
  render();
  return { render, resolve };
}

// Navigate programmatically (used by in-page "next chapter" links and presets).
export function go(route) {
  location.hash = route.startsWith("#") ? route : "#" + route;
}
