# Atlas research assistant (Cloudflare Worker)

A tiny grounded-RAG generation endpoint for the atlas's question panel. It runs
on **Cloudflare Workers AI** (free tier) so **no API key is ever shipped to the
browser**. The static site works without it — when no endpoint is configured the
panel falls back to client-side retrieval and shows the matching passages
directly. This Worker only adds the generative answer layer.

## How retrieval is split

The corpus (`app/public/data/corpus.json`, ~40 chunks) is small enough that
retrieval runs **in the browser**. The page finds the top passages for a
question and POSTs them here as `context`. The Worker's only job is grounded
generation, which keeps it stateless and means there is no vector index to
provision.

```
POST /  { "question": "what is Moran's I?", "context": [ { "title": "...", "text": "...", "url": "..." }, ... ] }
→  text/event-stream of  data: {"response":"<token>"}  ...  data: [DONE]
```

## Deploy

```bash
npm install -g wrangler        # if not present
cd worker
wrangler login                 # opens browser, one time
wrangler deploy                # publishes to <name>.<subdomain>.workers.dev
```

`wrangler deploy` prints the live URL. Wire it into the site one of two ways:

- **Build-time:** set `VITE_ASSISTANT_ENDPOINT` before `npm run build` (and in
  the GitHub Pages workflow env).
- **Runtime:** open the panel on the live site, click the gear, paste the URL.
  It is stored in `localStorage` — handy for testing without a rebuild.

## Optional: a stronger fallback model

Workers AI alone is enough. To add a Groq (Llama 70B) fallback for when Workers
AI is busy:

```bash
wrangler secret put GROQ_API_KEY    # paste the key when prompted
```

The Worker uses Workers AI first and only falls back to Groq on error. The key
lives in the Worker's secret store, never in the repo or the client.

## Tighten CORS for production

By default the Worker reflects the request origin. To lock it to the live site,
uncomment `ALLOWED_ORIGIN` in `wrangler.toml` (or set it as a var) to
`https://ihelfrich.github.io` and redeploy.

## Local dev

```bash
wrangler dev      # local endpoint, usually http://localhost:8787
```

Then set the panel endpoint (gear icon) to the dev URL.
