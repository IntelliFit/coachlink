// Global urllib proxy bootstrap (no app code changes)
// Reads HTTPS_PROXY/HTTP_PROXY and sets a global ProxyAgent for urllib/undici.
try {
  const { ProxyAgent, setGlobalDispatcher } = require('urllib');
  const url = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
  if (url) {
    const agent = new ProxyAgent(url);
    setGlobalDispatcher(agent);
    const safe = url.replace(/:\/\/([^:@]+):([^@]+)@/, '://$1:****@');
    console.log(`[urllib-proxy] Proxy enabled via ${safe}`);
  } else {
    console.log('[urllib-proxy] No proxy env set; skipping');
  }
} catch (e) {
  console.error('[urllib-proxy] Failed to set global proxy:', e && e.message);
}
