// Cloudflare Worker entry: serves the static site from ./public and handles POST /api/subscribe.
import { onRequestPost } from '../functions/api/subscribe.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/subscribe') {
      if (request.method === 'POST') return onRequestPost({ request, env });
      return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', Allow: 'POST' } });
    }
    return env.ASSETS.fetch(request);
  },
};
