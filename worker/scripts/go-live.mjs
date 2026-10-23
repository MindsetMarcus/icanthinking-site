#!/usr/bin/env node
// Switches the site from staging (hidden from search engines) to live.
//   node scripts/go-live.mjs            -> run in the repo root
//   node scripts/go-live.mjs --dry-run  -> show what would change
// It refuses to run while placeholders or prototype wording are still in the pages.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[1], '..', '..', 'public');
const dry = process.argv.includes('--dry-run');
const BLOCKERS = ['[[TODO', 'Draft price', 'Prototype only', 'Nothing is sent'];

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const html = walk(root).filter(f => f.endsWith('.html'));

const problems = [];
for (const f of html) {
  const t = fs.readFileSync(f, 'utf8');
  for (const b of BLOCKERS) if (t.includes(b)) problems.push(`${path.relative(root, f)} still contains "${b}"`);
}
if (problems.length) {
  console.error('Not ready to go live:\n - ' + problems.join('\n - '));
  console.error('\nFix these first (for example the privacy and terms pages), then run this again.');
  process.exit(1);
}

// 1. remove the noindex header block
const hp = path.join(root, '_headers');
let h = fs.readFileSync(hp, 'utf8');
const h2 = h.replace(/[ \t]*# STAGING-ONLY-START[\s\S]*?# STAGING-ONLY-END\n?/g, '');
// 2. swap robots.txt
const live = path.join(root, 'robots.live.txt');
// 3. strip the staging banner and noindex meta from pages (404/privacy/terms keep noindex only if they were thin)
const changes = [];
for (const f of html) {
  let t = fs.readFileSync(f, 'utf8');
  const n = t.replace(/<div class="proto">[\s\S]*?<\/div>\n?/, '');
  if (n !== t) changes.push([f, n]);
}
if (dry) {
  console.log('Would remove STAGING-ONLY block from _headers:', h !== h2);
  console.log('Would replace robots.txt with robots.live.txt');
  console.log('Would remove the staging banner from', changes.length, 'pages');
  process.exit(0);
}
fs.writeFileSync(hp, h2);
fs.copyFileSync(live, path.join(root, 'robots.txt'));
fs.unlinkSync(live);
for (const [f, n] of changes) fs.writeFileSync(f, n);
console.log('Done. The site is now set to be indexed. Commit and deploy, then submit sitemap.xml in Google Search Console and Bing Webmaster Tools.');
