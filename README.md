# iCan Thinking website

Static site for Cloudflare Pages, with one small Pages Function for sign-ups.
Typeface is Comfortaa, self-hosted. No cookies, so no cookie banner is needed.

```
public/      the website (this is what Cloudflare serves)
functions/   api/subscribe.js - the sign-up form handler
worker/      index.js - serves the site and routes /api/subscribe to the handler
scripts/     go-live.mjs - switches from staging to live
```

## 1. Put it on Cloudflare (staging first)

The site starts in **staging mode**: every page is sent with `noindex`, and robots.txt blocks crawlers. Nothing can appear in Google until you go live.

**Option A - GitHub (recommended, updates itself)**
1. Push this folder to a private GitHub repo.
2. Cloudflare dashboard > Workers & Pages > Create > Import a repository. Pick the repo.
3. Project name `icanthinking-site` (it must match `name` in `wrangler.toml`). Build command: leave empty. Deploy command: `npx wrangler deploy`. Root directory: leave empty.
4. Deploy. You get a `something.workers.dev` address to review the site on. Every later change on GitHub redeploys automatically.

**Option B - upload from your computer**
1. Install Node.js, then in this folder run `npm install` and `npx wrangler login`.
2. Run `npm run deploy`.

## 2. Turn on sign-ups

1. Create a MailerLite account (or tell us if you prefer another provider and the function can be changed).
2. MailerLite > Integrations > API > create a token.
3. Make a group for each list you want, for example "iCan Start" and one per waitlist. Note each group ID.
4. In Cloudflare: your project > Settings > Variables and Secrets:
   - `MAILERLITE_API_KEY` (as a Secret): the token
   - `MAILERLITE_GROUPS` (text): `{"default":"111","start":"111","waitlist-lead":"222","waitlist-speak":"333","waitlist-sell":"444","waitlist-wealth":"555"}`
5. Redeploy, then test with your own email. Until the key is added the form shows an honest "not switched on yet" message instead of pretending it worked.

The function has not yet been run against a live MailerLite account, so please test it once before launch.

## 3. Connect icanthinking.com

1. Project > Settings > Domains & Routes > Add > Custom domain: add `icanthinking.com` and `www.icanthinking.com`.
2. If the domain is not on Cloudflare yet, add it (Add a site) and change the nameservers at your registrar to the two Cloudflare ones. Before you do, copy across every DNS record you already use.
   **Keep the existing `app` record** (app.icanthinking.com) exactly as it is, plus any MX/email records, or the app and email will stop working.
3. Add a redirect from www to the main address: Rules > Redirect Rules > `www.icanthinking.com/*` to `https://icanthinking.com/$1` (301).
4. SSL/TLS > set to Full (strict). Optional: turn on Web Analytics (cookie-free).

## 4. Before going live

Search the site for `[[TODO` and fix every one:
- `public/privacy/index.html` and `public/terms/index.html` need real, reviewed text.
- Replace the draft prices and the "Prototype for review" banner copy (go-live checks for these).
- Add a booking link for "Book a discovery call", and the real speaking enquiry email.
- Add social profile URLs to the schema `sameAs` if you have them.

Then run:

```
node scripts/go-live.mjs --dry-run
node scripts/go-live.mjs
```

It refuses to run while placeholders remain. When it passes it removes the noindex header, swaps in the live robots.txt (which welcomes search and AI crawlers) and removes the staging banner. Commit, deploy, then submit `https://icanthinking.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools.

## What is already set up for search and AI answers
- Real URL for every page, unique titles and descriptions, canonical tags, Open Graph and Twitter cards
- JSON-LD: Organization, Person, WebSite, Course, FAQ, Breadcrumbs (no invented ratings or prices)
- `sitemap.xml`, `robots.txt`, `llms.txt`, one H1 per page, `lang="en-GB"`
- Security headers and a strict Content Security Policy in `public/_headers`
- Friendly short links in `public/_redirects` (for example `/foundation`)

## Blog
Posts live in `content/blog/` as one file each (`.md`, or `.html` for hand-written HTML). To publish:
1. Add or edit a file in `content/blog/` (the header at the top of `scripts/build-blog.mjs` shows the format).
2. Run `node scripts/build-blog.mjs`. It rebuilds `public/blog/`, the Blog menu link, `sitemap.xml` and `llms.txt`.
3. Commit and push. Cloudflare deploys it.
The generated files in `public/` are committed, because Cloudflare does not run a build step here.

## Local preview
`npm install` then `npm run dev` (add a `.dev.vars` file, see `.dev.vars.example`, to test the form).
