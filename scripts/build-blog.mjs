#!/usr/bin/env node
// Builds the iCan Thinking blog from simple files, so adding a blog is "drop in one file and run this".
//
//   node scripts/build-blog.mjs
//
// Each post lives in content/blog/<slug>.md (or .html if you need hand-written HTML) and starts with a small header:
//
//   ---
//   title: Anger: The Hidden Self-Punishment We Don't Talk About
//   subtitle: (optional) a line under the title
//   date: 2025-07-18           (optional, YYYY-MM-DD; posts with no date are listed last)
//   tag: Emotional mastery
//   description: One or two sentences for Google and social sharing (about 150 characters)
//   excerpt: (optional) the text on the blog index card; defaults to the description
//   image: (optional) name of an illustration in public/assets/img/blog/ without the extension (needs a .svg and a 1200x630 .png)
//   image_alt: (optional) a short description of the image for screen readers
//   byline: (optional) replaces "By Marcus Thomlinson", for example "A coaching story"
//   disclaimer: true           (optional) adds the "not medical advice" note
//   author_box: false          (optional) hides the "About Marcus" box
//   ---
//
// Then write the post in Markdown: ## headings, ### sub-headings, - bullets, 1. numbered lists,
// > pull quotes, **bold**, *italic*, [links](https://...).
//
// The script then:
//   - writes public/blog/index.html and public/blog/<slug>/index.html using the site's own header, footer and styles
//   - adds a Blog link to the menu and footer of every page (once)
//   - updates public/sitemap.xml and public/llms.txt
// It stops with a clear message if a post breaks a house rule (long dashes, the wrong spelling of iCan).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(repo, 'public');
const CONTENT = path.join(repo, 'content', 'blog');
const SITE = 'https://icanthinking.com';
const TODAY = new Date().toISOString().slice(0, 10);
const FOUNDING_ENDS = '2027-01-02'; // the founding-member line is dropped automatically after this date

const DISCLAIMER = 'This post is for general information and inspiration. It is not medical advice. Please speak to your GP before trying fasting, especially if you have a medical condition, take medication, are pregnant, or have ever had a difficult relationship with food.';

// ---------- helpers ----------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = h => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
const slugify = s => plain(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const fmtDate = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${new Date(Date.UTC(y, m - 1, d)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })} ${y}`;
};
const fail = msg => { console.error('\nProblem: ' + msg + '\n'); process.exit(1); };

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

// ---------- markdown (the small subset we use) ----------
function inline(t) {
  t = esc(t);
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, (_, a, u) => `<a href="${u}">${a}</a>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');
  return t;
}

function markdown(src) {
  const out = [];
  for (const block of src.replace(/\r\n/g, '\n').trim().split(/\n{2,}/)) {
    const lines = block.split('\n');
    const first = lines[0];
    if (/^---+$/.test(block.trim())) out.push('<hr>');
    else if (/^### /.test(first)) out.push(`<h3>${inline(first.slice(4))}</h3>`);
    else if (/^## /.test(first)) {
      const t = first.slice(3);
      out.push(`<h2 id="${slugify(t)}">${inline(t)}</h2>`);
    } else if (lines.every(l => /^> ?/.test(l))) out.push(`<blockquote><p>${inline(lines.map(l => l.replace(/^> ?/, '')).join('\n')).replace(/\n/g, '<br>\n')}</p></blockquote>`);
    else if (lines.every(l => /^[-*] /.test(l))) out.push('<ul>' + lines.map(l => `<li>${inline(l.slice(2))}</li>`).join('') + '</ul>');
    else if (lines.every(l => /^\d+\. /.test(l))) out.push('<ol>' + lines.map(l => `<li>${inline(l.replace(/^\d+\. /, ''))}</li>`).join('') + '</ol>');
    else out.push(`<p>${lines.map(inline).join('<br>\n')}</p>`);
  }
  return out.join('\n');
}

// ---------- read posts ----------
function readPost(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) fail(`${path.relative(repo, file)} needs a header between two --- lines (see the top of scripts/build-blog.mjs).`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const k = line.match(/^([a-z_]+):\s*(.*)$/);
    if (k) meta[k[1]] = k[2].trim();
  }
  const slug = path.basename(file).replace(/\.(md|html)$/, '');
  const name = path.relative(repo, file);
  for (const req of ['title', 'tag', 'description']) if (!meta[req]) fail(`${name} is missing "${req}:" in its header.`);
  if (meta.date && !/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) fail(`${name}: date must look like 2025-07-18.`);
  const body = file.endsWith('.html') ? m[2].trim() : markdown(m[2]);
  const check = meta.title + ' ' + (meta.subtitle || '') + ' ' + meta.description + ' ' + (meta.excerpt || '') + ' ' + plain(body);
  if (/[—–]/.test(check)) fail(`${name} contains a long dash. Use a hyphen or reword (house style).`);
  if (/ICANN/.test(check)) fail(`${name} says "ICANN". The brand is spelled "iCan" / "iCan Thinking".`);
  if (meta.image) for (const ext of ['svg', 'png']) if (!fs.existsSync(path.join(PUBLIC, 'assets', 'img', 'blog', `${meta.image}.${ext}`))) fail(`${name}: image "${meta.image}.${ext}" not found in public/assets/img/blog/.`);
  if (meta.image && !meta.image_alt) fail(`${name}: add an image_alt: line describing the image.`);
  const words = plain(body).split(/\s+/).length;
  return {
    slug, body, words,
    title: meta.title, subtitle: meta.subtitle || '', date: meta.date || '', tag: meta.tag,
    description: meta.description, excerpt: meta.excerpt || meta.description,
    image: meta.image || '', imageAlt: meta.image_alt || '',
    byline: meta.byline || 'By Marcus Thomlinson',
    disclaimer: meta.disclaimer === 'true', authorBox: meta.author_box !== 'false',
    mins: Math.max(1, Math.round(words / 200)),
  };
}

if (!fs.existsSync(CONTENT)) fail('content/blog/ not found.');
const posts = fs.readdirSync(CONTENT).filter(f => /\.(md|html)$/.test(f)).map(f => readPost(path.join(CONTENT, f)));
const slugs = new Set();
for (const p of posts) { if (slugs.has(p.slug)) fail(`Two posts share the name "${p.slug}".`); slugs.add(p.slug); }
// newest first, undated posts last
posts.sort((a, b) => (b.date || '0000').localeCompare(a.date || '0000') || a.title.localeCompare(b.title));

// ---------- 1. add the Blog link to every page's menu and footer (once) ----------
const NAV_LINK = '<a href="/blog/">Blog</a>';
const FOOT_LINK = '<li><a href="/blog/">Blog</a></li>';
let patched = 0;
for (const f of walk(PUBLIC).filter(f => f.endsWith('.html'))) {
  if (f.startsWith(path.join(PUBLIC, 'blog') + path.sep)) continue;
  let t = fs.readFileSync(f, 'utf8');
  let n = t;
  if (!/<nav aria-label="Main">[^]*?href="\/blog\/"/.test(n)) n = n.replace(/(<nav aria-label="Main">[^]*?)(<a href="\/about-marcus\/">About Marcus<\/a>)/, `$1${NAV_LINK}$2`);
  if (!/<h4>Company<\/h4><ul>[^]*?href="\/blog\/"/.test(n)) n = n.replace(/(<h4>Company<\/h4><ul>[^]*?)(<li><a href="\/reviews\/">Reviews<\/a><\/li>)/, `$1$2${FOOT_LINK}`);
  if (n !== t) { fs.writeFileSync(f, n); patched++; }
}

// ---------- 2. reuse the site's real header, footer, styles and script ----------
const refPage = fs.readFileSync(path.join(PUBLIC, 'coaches', 'index.html'), 'utf8');
const header = (refPage.match(/<a class="skip"[^]*?<\/header>/) || [])[0];
const footer = (refPage.match(/<footer class="site">[^]*?<\/footer>/) || [])[0];
const siteCss = (refPage.match(/<link rel="stylesheet" href="\/assets\/css\/site\.[a-f0-9]+\.css">/) || [])[0];
const siteJs = (refPage.match(/<script src="\/assets\/js\/site\.[a-f0-9]+\.js" defer><\/script>/) || [])[0];
if (!header || !footer || !siteCss) fail('Could not read the header, footer or stylesheet from public/coaches/index.html.');

// hashed blog stylesheet (the site caches /assets/css forever, so a new name is needed whenever it changes)
const css = fs.readFileSync(path.join(repo, 'scripts', 'blog.css'), 'utf8');
const hash = crypto.createHash('sha1').update(css).digest('hex').slice(0, 10);
const cssDir = path.join(PUBLIC, 'assets', 'css');
for (const f of fs.readdirSync(cssDir)) if (/^blog\.[a-f0-9]+\.css$/.test(f)) fs.unlinkSync(path.join(cssDir, f));
fs.writeFileSync(path.join(cssDir, `blog.${hash}.css`), css);
const blogCss = `<link rel="stylesheet" href="/assets/css/blog.${hash}.css">`;

// ---------- 3. page templates ----------
function page({ title, description, url, bodyHtml, jsonld, ogType, ogImage = '/assets/img/og-image.png' }) {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="author" content="Marcus Thomlinson">
<meta name="theme-color" content="#F7F3EC" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16212C" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="iCan Thinking">
<meta property="og:locale" content="en_GB">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="iCan Thinking. Small daily wins. Big life changes.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}${ogImage}">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="sitemap" type="application/xml" href="/sitemap.xml">
<link rel="preload" href="/assets/fonts/comfortaa-latin.woff2" as="font" type="font/woff2" crossorigin>
${siteCss}
${blogCss}
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
${header}
<main id="main">
${bodyHtml}
</main>
${footer}
${siteJs || ''}
</body>
</html>
`;
}

const cardHtml = p => `<li><a class="blog-card" href="/blog/${p.slug}/">${p.image ? `<img class="blog-card-img" src="/assets/img/blog/${p.image}.svg" alt="" width="1200" height="630" loading="lazy">` : ''}<span class="tag">${esc(p.tag)}</span><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p><span class="foot"><span>${p.date ? fmtDate(p.date) : 'From the archive'}</span><span>${p.mins} min read</span><span class="go">Read more &rarr;</span></span></a></li>`;

const showFounding = TODAY < FOUNDING_ENDS;
const cta = `<aside class="blog-cta" aria-labelledby="cta-title">
<div class="eyebrow">Your next step</div>
<h2 id="cta-title">Ready to put this into practice?</h2>
<p>iCan Thinking helps you beat stress and create the best possible mental health, one small mindset shift at a time. Start free with iCan Start: the iCan app, basic habit tracking and the iCan Community.</p>
<div class="actions"><a class="btn btn-primary" href="/start/">Join iCan Start free</a><a class="btn btn-ghost" href="/book/">Book a discovery call</a></div>
${showFounding ? '<p class="small">Founding member pricing on iCan Commit (&pound;14 a month instead of &pound;19) runs until our full launch on 2 January 2027.</p>' : ''}
</aside>`;

const author = `<div class="post-author"><img src="/assets/img/marcus-thomlinson.webp" alt="Marcus Thomlinson" width="64" height="64" loading="lazy"><p><strong>Marcus Thomlinson</strong> is a coach, speaker and the founder of iCan Thinking. He helps people beat stress, think clearly and build a calmer, more successful life through mindset.</p></div>`;

// ---------- 4. write pages ----------
const blogDir = path.join(PUBLIC, 'blog');
fs.rmSync(blogDir, { recursive: true, force: true });
fs.mkdirSync(blogDir, { recursive: true });

for (const p of posts) {
  const url = `${SITE}/blog/${p.slug}/`;
  const others = posts.filter(q => q !== p).slice(0, 3);
  const meta = [p.byline, p.date ? 'Originally published ' + fmtDate(p.date) : null, `${p.mins} min read`].filter(Boolean).map(m => `<li>${esc(m)}</li>`).join('');
  const bodyHtml = `<section class="band blog-hero"><div class="wrap">
<a class="tag" href="/blog/">${esc(p.tag)}</a>
<h1>${esc(p.title)}</h1>
${p.subtitle ? `<p class="sub">${esc(p.subtitle)}</p>` : ''}
<ul class="meta">${meta}</ul>
</div></section>
<section class="sec"><div class="wrap blog-wrap"><article class="post">
${p.image ? `<figure class="post-hero"><img src="/assets/img/blog/${p.image}.svg" alt="${esc(p.imageAlt)}" width="1200" height="630"></figure>` : ''}
${p.body}
${p.disclaimer ? `<aside class="post-note"><strong>A quick note:</strong> ${esc(DISCLAIMER.replace(/^This post is for general information and inspiration\. /, 'this post is for general information and inspiration. '))}</aside>` : ''}
${cta}
${p.authorBox ? author : ''}
</article></div></section>
${others.length ? `<section class="sec alt"><div class="wrap"><h2>More from the iCan blog</h2><ul class="blog-cards">${others.map(cardHtml).join('')}</ul></div></section>` : ''}`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting', headline: p.title, description: p.description, inLanguage: 'en-GB', url,
        mainEntityOfPage: url, wordCount: p.words, articleSection: p.tag,
        ...(p.date ? { datePublished: p.date } : {}),
        author: { '@type': 'Person', '@id': `${SITE}/about-marcus/#marcus`, name: 'Marcus Thomlinson' },
        publisher: { '@id': `${SITE}/#organization` },
        image: `${SITE}${p.image ? `/assets/img/blog/${p.image}.png` : '/assets/img/og-image.png'}`,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE + '/blog/' },
          { '@type': 'ListItem', position: 3, name: p.title, item: url },
        ],
      },
    ],
  };
  const dir = path.join(blogDir, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page({ title: `${p.title} | iCan Thinking`, description: p.description, url, bodyHtml, jsonld, ogType: 'article', ogImage: p.image ? `/assets/img/blog/${p.image}.png` : undefined }));
}

const indexBody = `<section class="band blog-hero"><div class="wrap">
<div class="eyebrow">The iCan blog</div>
<h1>See it. Feel it. Believe it.</h1>
<p class="sub">Mindset, health and calm for a less stressful, more successful life. Fresh thinking from Marcus Thomlinson and the iCan Thinking community.</p>
</div></section>
<section class="sec"><div class="wrap"><h2>Latest posts</h2><ul class="blog-cards">${posts.map(cardHtml).join('')}</ul></div></section>`;
fs.writeFileSync(path.join(blogDir, 'index.html'), page({
  title: 'The iCan Thinking Blog | Mindset, health and calm',
  description: 'Mindset, health and calm for a less stressful, more successful life. Blog posts from Marcus Thomlinson and the iCan Thinking community.',
  url: SITE + '/blog/', bodyHtml: indexBody, ogType: 'website',
  jsonld: {
    '@context': 'https://schema.org', '@type': 'Blog', name: 'The iCan Thinking Blog', url: SITE + '/blog/', inLanguage: 'en-GB',
    publisher: { '@id': `${SITE}/#organization` },
    blogPost: posts.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/blog/${p.slug}/` })),
  },
}));

// ---------- 5. sitemap.xml and llms.txt ----------
const smPath = path.join(PUBLIC, 'sitemap.xml');
let sm = fs.readFileSync(smPath, 'utf8').replace(/[ \t]*<url><loc>https:\/\/icanthinking\.com\/blog\/[^]*?<\/url>\n?/g, '');
const smLines = [`  <url><loc>${SITE}/blog/</loc><lastmod>${TODAY}</lastmod><priority>0.8</priority></url>`]
  .concat(posts.map(p => `  <url><loc>${SITE}/blog/${p.slug}/</loc><lastmod>${p.date || TODAY}</lastmod><priority>0.6</priority></url>`));
sm = sm.replace('</urlset>', smLines.join('\n') + '\n</urlset>');
fs.writeFileSync(smPath, sm);

const llmsPath = path.join(PUBLIC, 'llms.txt');
let llms = fs.readFileSync(llmsPath, 'utf8').replace(/\n## Blog\n[^]*?(?=\n## )/, '');
const blogSection = `\n## Blog\n- [The iCan Thinking blog](${SITE}/blog/): mindset, health and calm for a less stressful life\n` +
  posts.map(p => `- [${p.title}](${SITE}/blog/${p.slug}/): ${p.description}`).join('\n') + '\n';
llms = llms.includes('\n## Optional') ? llms.replace('\n## Optional', blogSection + '\n## Optional') : llms.trimEnd() + '\n' + blogSection;
fs.writeFileSync(llmsPath, llms);

console.log(`Built ${posts.length} blog posts and the blog index. Added the Blog link to ${patched} page(s). Blog stylesheet: blog.${hash}.css`);
for (const p of posts) console.log(` - /blog/${p.slug}/  (${p.words} words, ${p.mins} min)`);
