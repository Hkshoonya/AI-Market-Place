const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Temporarily unavailable | AI Market Cap</title>
<style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#09090b;color:#fafafa;font-family:Geist,ui-sans-serif,sans-serif;min-height:100svh;display:grid;place-items:center;padding:24px;background-image:radial-gradient(ellipse at 50% 0, #00d4aa12,transparent 65%)}main{width:100%;max-width:600px;padding:48px 24px;text-align:center;border:1px solid #ffffff14;border-radius:24px;background:#111113}.brand{color:#00d4aa;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.2em}.mark{display:inline-grid;place-items:center;width:64px;height:64px;border-radius:16px;border:1px solid #00d4aa40;background:#00d4aa12;color:#00d4aa;font-size:30px}h1{font-size:clamp(26px,5vw,36px);letter-spacing:-.03em;margin:24px 0 16px}p{color:#a1a1aa;font-size:15px;line-height:1.7}.actions{display:flex;justify-content:center;gap:12px;margin-top:28px;flex-wrap:wrap}a{display:inline-block;padding:12px 18px;border-radius:9px;border:1px solid #ffffff26;text-decoration:none;color:#fafafa;font-size:14px}a:first-child{background:#00d4aa;color:#09090b;border-color:#00d4aa;font-weight:600}a:focus-visible{outline:3px solid #fafafa;outline-offset:4px}.note{font-size:12px;margin-top:24px}@media(max-width:480px){main{padding:36px 20px}.actions{flex-direction:column}}</style>
</head><body><main><span class="mark" aria-hidden="true">&#8767;</span>
<p class="brand">AI Market Cap</p><h1>Temporarily unavailable</h1>
<p>We're having trouble connecting to our services. Live data and sign-in may be temporarily interrupted. Please try again shortly.</p>
<div class="actions"><a href="/">Try homepage</a><a href="https://aimarketcap-uptime-monitor.sense-fbf.workers.dev/" target="_blank" rel="noopener noreferrer">Service status</a></div>
<p class="note">If a payment or submission timed out, check its status before submitting it again. Please avoid refreshing repeatedly while services recover.</p>
</main></body></html>`;

export function isHtmlNavigation(request) {
  const url = new URL(request.url);
  return ["GET", "HEAD"].includes(request.method)
    && ["aimarketcap.tech", "www.aimarketcap.tech"].includes(url.hostname)
    && (request.headers.get("Accept") ?? "").includes("text/html")
    && !/^\/(?:api|auth|_next)(?:\/|$)/.test(url.pathname)
    && !request.headers.has("RSC") && !request.headers.has("Next-Router-State-Tree")
    && !request.headers.has("Next-Router-Prefetch");
}

export function interruptionResponse(method = "GET") {
  return new Response(method === "HEAD" ? null : PAGE, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": "60",
      "X-Robots-Tag": "noindex",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      "X-AIMC-Service-Fallback": "1",
    },
  });
}

export async function proxyWithFallback(request, fetchOrigin = (input) => globalThis.fetch(input)) {
  if (!isHtmlNavigation(request)) return fetchOrigin(request);
  let response;
  try {
    response = await fetchOrigin(request);
  } catch {
    return interruptionResponse(request.method);
  }
  if (response.status < 500) return response;
  // Do not buffer origin responses, retain error bodies, or expose diagnostics.
  await response.body?.cancel().catch(() => undefined);
  return interruptionResponse(request.method);
}
