#!/usr/bin/env node
/**
 * check-site.mjs — every path the built pages reference must exist on disk.
 *
 *   BASE_PATH=/UI-skill node scripts/build-site.mjs && node scripts/check-site.mjs
 *
 * GitHub Pages serves under /<repo>/, so the classic failure is a page that loads and
 * then 404s its own stylesheet or module. This resolves each href, src and dynamic
 * import in the built HTML against the deploy base and fails on the first miss.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '_site');
const BASE = process.env.BASE_PATH || '/UI-skill';

// Forward slashes on purpose: these double as URL directories below.
const pages = ['index.html', 'examples/index.html'].filter((page) => existsSync(join(OUT, page)));

if (!pages.length) {
  console.error('no _site/index.html - run `npm run site:build` first');
  process.exit(1);
}

let missing = 0;
let checked = 0;

for (const page of pages) {
  const html = readFileSync(join(OUT, page), 'utf8');
  const urlDir = posix.join(BASE, posix.dirname('/' + page));
  const refs = [
    ...[...html.matchAll(/(?:href|src)="([^"]+\.(?:css|js|svg|webp|avif|jpg|png|webm))"/g)].map((m) => m[1]),
    ...[...html.matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1]),
    ...[...html.matchAll(/import\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]),
  ];

  for (const ref of refs) {
    if (/^(https?:|data:|blob:)/.test(ref)) continue;
    checked += 1;
    const abs = ref.startsWith('/') ? ref : posix.normalize(posix.join(urlDir, ref));
    const onDisk = join(OUT, abs.slice(BASE.length));
    if (!existsSync(onDisk)) {
      missing += 1;
      console.log(`BROKEN  ${page} -> ${ref}  (${posix.normalize(abs)})`);
    }
  }
}

if (missing) {
  console.error(`\n${missing} of ${checked} references do not resolve under ${BASE}`);
  process.exit(1);
}
console.log(`${checked} references resolve under ${BASE} · ${pages.length} pages checked`);
