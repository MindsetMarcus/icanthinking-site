// Cloudflare Pages Function: POST /api/subscribe
// Adds a subscriber to MailerLite. SCAFFOLD: written against MailerLite's documented API
// (POST https://connect.mailerlite.com/api/subscribers) but not yet tested with a live key.
//
// Settings (Pages > Settings > Variables and Secrets):
//   MAILERLITE_API_KEY  (secret)  your MailerLite API token
//   MAILERLITE_GROUPS   (text)    JSON map of source -> group id, e.g.
//                                 {"default":"123","start":"123","waitlist-lead":"456"}
//   MAILERLITE_GOAL_FIELD (text, optional) name of a custom text field to hold the "What brings you here?" answer
//   ALLOWED_ORIGINS     (text, optional) comma list; defaults to the site's own origin
//   RESEND_API_KEY      (secret, optional) lets the site email you each time someone joins
//   NOTIFY_TO           (text, optional) who gets the notification; defaults to info@icanthinking.com
//   NOTIFY_FROM         (text, optional) sender; defaults to "iCan Thinking <hello@icanthinking.com>"

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });


const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Emails you when someone joins. Never blocks or breaks the sign-up if it fails.
async function notify(env, { name, email, goal, source, isNew }) {
  if (!env.RESEND_API_KEY) return;
  const to = env.NOTIFY_TO || 'info@icanthinking.com';
  const from = env.NOTIFY_FROM || 'iCan Thinking <hello@icanthinking.com>';
  const where = source === 'start' ? 'iCan Start (the website sign-up)' : source;
  const html = `<p><strong>${isNew ? 'New subscriber' : 'Existing subscriber signed up again'}</strong></p>` +
    `<p>Name: ${esc(name)}<br>Email: ${esc(email)}<br>What brings them here: ${esc(goal || 'not given')}<br>Joined via: ${esc(where)}</p>`;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.RESEND_API_KEY },
      body: JSON.stringify({ from, to: [to], subject: `${isNew ? 'New sign-up' : 'Repeat sign-up'}: ${name} (${where})`, html }),
    });
  } catch { /* ignore */ }
}

export async function onRequestPost({ request, env, ctx }) {
  const origin = request.headers.get('Origin');
  const self = new URL(request.url).origin;
  const allowed = (env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : [self]);
  if (origin && !allowed.includes(origin)) return json({ error: 'forbidden', message: 'Sorry, that did not work.' }, 403);

  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_request', message: 'Please try again.' }, 400); }

  // Honeypot: bots fill this in. Pretend success.
  if (b.company) return json({ ok: true });

  const name = String(b.name || '').trim().slice(0, 80);
  const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
  const goal = String(b.goal || '').slice(0, 300);
  const source = /^[a-z0-9-]{1,40}$/.test(String(b.source || '')) ? b.source : 'default';
  if (!name) return json({ error: 'invalid', message: 'Please add your first name.' }, 422);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'invalid', message: 'Please check your email address.' }, 422);
  if (b.consent !== true) return json({ error: 'consent', message: 'Please tick the box so we know you are happy to hear from us.' }, 422);

  if (!env.MAILERLITE_API_KEY) return json({ error: 'not_configured', message: 'Sign-up is not switched on yet. Please check back soon.' }, 503);

  let groups = {};
  try { groups = JSON.parse(env.MAILERLITE_GROUPS || '{}'); } catch { /* ignore */ }
  const group = groups[source] || groups.default;

  const payload = {
    email,
    fields: { name, ...(goal && env.MAILERLITE_GOAL_FIELD ? { [env.MAILERLITE_GOAL_FIELD]: goal } : {}) },
    ip_address: request.headers.get('CF-Connecting-IP') || undefined,
    opted_in_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    ...(group ? { groups: [group] } : {}),
  };

  let r;
  try {
    r = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + env.MAILERLITE_API_KEY },
      body: JSON.stringify(payload),
    });
  } catch {
    return json({ error: 'upstream', message: 'Sorry, something went wrong on our side. Please try again in a moment.' }, 502);
  }
  if (r.status === 200 || r.status === 201) {
    const job = notify(env, { name, email, goal, source, isNew: r.status === 201 });
    if (ctx && ctx.waitUntil) ctx.waitUntil(job); else await job;
    return json({ ok: true });
  }
  if (r.status === 422) return json({ error: 'invalid', message: 'That email address was not accepted. Please check it and try again.' }, 422);
  return json({ error: 'upstream', message: 'Sorry, something went wrong on our side. Please try again in a moment.' }, 502);
}

export const onRequest = () => json({ error: 'method_not_allowed' }, 405);
