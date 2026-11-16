/* Raízes do Futuro: Island Trend Detective, NASA POWER client for the browser.
   At most 3 requests in flight, a short gap between request starts, an in-memory cache
   (same URL is never downloaded twice in a session), cancellation and readable errors.
   Code written with AI assistance (Anthropic Claude) and reviewed by the team. */

const MAX_PARALLEL = 3;
const GAP_MS = 250;
const cache = new Map();          // url -> Promise<json>
const waiting = [];               // {run, reject, signal}
let active = 0, lastStart = 0;

export class PowerError extends Error {
  constructor(message, kind) { super(message); this.kind = kind; }
}

function pump() {
  while (active < MAX_PARALLEL && waiting.length) {
    const job = waiting.shift();
    if (job.signal?.aborted) { job.reject(abortError()); continue; }
    active++;
    const wait = Math.max(0, lastStart + GAP_MS - Date.now());
    lastStart = Date.now() + wait;
    setTimeout(() => job.run().finally(() => { active--; pump(); }), wait);
  }
}
function abortError() { return new PowerError("Cancelled.", "abort"); }

async function download(url, signal) {
  let r;
  try { r = await fetch(url, { signal }); }
  catch (e) {
    if (signal?.aborted) throw abortError();
    throw new PowerError("NASA POWER could not be reached. Check your connection; the service may also be down for a moment. Try again in a minute.", "network");
  }
  if (r.status === 429) throw new PowerError("NASA POWER is limiting requests right now (HTTP 429). Wait a minute and try again.", "busy");
  if (r.status >= 500) throw new PowerError(`NASA POWER is having trouble (HTTP ${r.status}). Try again in a few minutes.`, "down");
  let j = null;
  try { j = await r.json(); } catch { /* not JSON */ }
  if (!r.ok) {
    const msg = j && (j.messages || j.message || j.detail);
    const text = Array.isArray(msg) ? msg.map(m => m.msg || m).join(" ") : (typeof msg === "string" ? msg : "");
    throw new PowerError(`NASA POWER did not accept the request (HTTP ${r.status})${text ? ": " + text : "."}`, "request");
  }
  if (!j) throw new PowerError("NASA POWER sent an unreadable answer. Try again.", "format");
  return j;
}

/* Rate-limited, cached JSON download. A cancelled or failed request is not kept in the cache. */
export function getJson(url, { signal } = {}) {
  if (cache.has(url)) return cache.get(url);
  const p = new Promise((resolve, reject) => {
    const job = { signal, reject, run: () => download(url, signal).then(resolve, reject) };
    if (signal) signal.addEventListener("abort", () => {
      const i = waiting.indexOf(job);
      if (i >= 0) { waiting.splice(i, 1); reject(abortError()); }
    }, { once: true });
    waiting.push(job); pump();
  });
  cache.set(url, p);
  p.catch(() => cache.delete(url));
  return p;
}

export function cacheSize() { return cache.size; }
