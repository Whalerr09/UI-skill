#!/usr/bin/env node
/**
 * audit.mjs — static rule audit for a built site.
 *
 *   node scripts/audit.mjs ./dist
 *   node scripts/audit.mjs ./dist --json
 *   node scripts/audit.mjs assets examples        # several roots
 *   node scripts/audit.mjs ./dist --strict        # warnings fail the run
 *
 * It is deliberately static: no browser, no network, no dependencies. It catches
 * the mistakes that survive review — `transition: all`, layout properties in
 * transitions, unbounded `will-change`, scroll hijacking, canvases without
 * `aria-hidden`, motion with no reduced-motion escape hatch, oversized payloads.
 *
 * Exit code 0 = clean or warnings only. Exit code 1 = at least one error.
 *
 * Fix the cause. There is no ignore file by design.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', '.output', '.cache', '.turbo',
  '.vercel', '.netlify', '.svelte-kit', '.astro', 'coverage', '.DS_Store',
]);

const CODE_EXT = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.svg']);
const ASSET_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.mp4', '.webm', '.woff2', '.woff']);

const C = {
  reset: '\u001b[0m', dim: '\u001b[2m', bold: '\u001b[1m',
  red: '\u001b[31m', yellow: '\u001b[33m', green: '\u001b[32m', cyan: '\u001b[36m',
};
const tty = process.stdout.isTTY;
const paint = (c, text) => (tty ? `${c}${text}${C.reset}` : text);

/* ------------------------------------------------------------------- cli */

function parseArgs(argv) {
  const roots = [];
  const flags = { json: false, strict: false, quiet: false };

  for (const arg of argv) {
    if (arg === '--json') flags.json = true;
    else if (arg === '--strict') flags.strict = true;
    else if (arg === '--quiet' || arg === '-q') flags.quiet = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(`
ui-motion audit — static rule audit

  node scripts/audit.mjs [paths...] [options]

  paths        Folders or files to scan. Default: ./dist, else .
  --strict     Treat warnings as failures
  --json       Machine-readable output
  --quiet      Summary only

  Checks: transition: all · layout props in transitions · unbounded will-change ·
  scroll hijacking · canvas without aria-hidden · outline removal · motion without
  a reduced-motion block · lazy hero images · missing width/height · viewport
  zoom lock · z-index sprawl · 100vh · JS/CSS/image weight · WebGL context count.
`);
      process.exit(0);
    } else if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`);
      process.exit(2);
    } else roots.push(arg);
  }

  if (!roots.length) roots.push(existsSync('dist') ? 'dist' : '.');
  return { roots, flags };
}

/* ------------------------------------------------------------------ model */

const findings = [];

// Cross-file state: a reduced-motion block anywhere in the stylesheet set covers
// every sheet, so this has to be judged per project, not per file.
const project = { cssAnimates: false, hasReducedMotion: false, infinite: false };

function report(file, line, severity, rule, message, fix) {
  findings.push({ file, line, severity, rule, message, fix });
}

/* ------------------------------------------------------------------- walk */

async function walk(root, out) {
  const info = await stat(root).catch(() => null);
  if (!info) return;

  if (info.isFile()) {
    out.push({ path: root, size: info.size });
    return;
  }

  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.well-known') continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(full, out);
    } else if (entry.isFile()) {
      const s = await stat(full);
      out.push({ path: full, size: s.size });
    }
  }
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

function eachMatch(text, regex, fn) {
  regex.lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    fn(match, lineOf(text, match.index));
    if (match[0].length === 0) regex.lastIndex += 1;
  }
}

/* -------------------------------------------------------------------- css */

const LAYOUT_PROPS = /\b(width|height|top|left|right|bottom|margin[a-z-]*|padding[a-z-]*)\b/;

function auditCss(file, text) {
  const hasFocusVisible = /:focus-visible/.test(text);

  if (/transition|animation/i.test(text)) project.cssAnimates = true;
  if (/prefers-reduced-motion/.test(text)) project.hasReducedMotion = true;
  if (/animation[^;{}]*\binfinite\b/i.test(text)) project.infinite = true;

  eachMatch(text, /transition(?:-property)?\s*:\s*all\b/gi, (m, line) =>
    report(file, line, 'error', 'transition-all',
      '`transition: all` animates every property, including layout.',
      'List the properties: `transition: opacity 320ms var(--ease-out), transform 320ms var(--ease-out)`.'));

  eachMatch(text, /transition(?:-property)?\s*:([^;{}]*)/gi, (m, line) => {
    const value = m[1].replace(/cubic-bezier\([^)]*\)/g, '');
    const hit = value.match(LAYOUT_PROPS);
    if (!hit) return;
    if (/grid-template-rows/.test(value)) return; // documented accordion exception
    report(file, line, 'error', 'transition-layout',
      `Transition on \`${hit[1]}\` triggers layout every frame.`,
      'Switch to transform/opacity, or animate `grid-template-rows` for accordions.');
  });

  eachMatch(text, /will-change\s*:\s*([^;{}]+)/gi, (m, line) => {
    const value = m[1].trim();
    const count = value.split(',').length;
    if (/^all\b/i.test(value)) {
      report(file, line, 'error', 'will-change-all',
        '`will-change: all` forces a layer for everything.',
        'Use `will-change` on one or two properties, only while animating.');
    } else if (count > 2) {
      report(file, line, 'warn', 'will-change-budget',
        `\`will-change\` lists ${count} properties; each one costs a layer.`,
        'Keep it to the one or two properties that actually animate.');
    }
  });

  eachMatch(text, /outline\s*:\s*(none|0)\b/gi, (m, line) => {
    if (hasFocusVisible) return;
    report(file, line, 'error', 'outline-removed',
      'Focus outline removed with no `:focus-visible` replacement.',
      'Add `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`.');
  });

  eachMatch(text, /z-index\s*:\s*(-?\d+)/gi, (m, line) => {
    if (Number(m[1]) < 1000) return;
    report(file, line, 'warn', 'z-index-sprawl',
      `z-index ${m[1]} suggests stacking is being patched, not designed.`,
      'Keep a documented ladder: base 0, sticky 10, nav 20, overlay 30, toast 40.');
  });

  eachMatch(text, /\b100vh\b/g, (m, line) =>
    report(file, line, 'warn', 'vh-mobile',
      '`100vh` is taller than the mobile viewport and causes a jump.',
      'Use `100svh` (or `100dvh` when the layout should follow the toolbar).'));

  eachMatch(text, /@import\s+(?:url\()?['"]/gi, (m, line) =>
    report(file, line, 'error', 'css-import',
      '`@import` serialises the CSS waterfall and blocks first paint.',
      'Concatenate at build time, or load the second sheet with `<link rel="stylesheet">`.'));
}

/* --------------------------------------------------------------------- js */

function auditJs(file, text) {
  const scrollListeners = (text.match(/addEventListener\(\s*['"]scroll['"]/g) || []).length;
  if (scrollListeners > 2) {
    report(file, 1, 'warn', 'scroll-listeners',
      `${scrollListeners} scroll listeners; each one is a separate layout read risk.`,
      'One passive listener, rAF-coalesced, publishing custom properties.');
  }

  eachMatch(text, /addEventListener\(\s*['"](?:wheel|touchmove)['"]\s*,([\s\S]{0,400}?)\)\s*;/g, (m, line) => {
    if (!/preventDefault/.test(m[1])) return;
    report(file, line, 'error', 'scroll-hijack',
      'Wheel/touch listener calls preventDefault — the page no longer scrolls natively.',
      'Never intercept scroll. Use sticky pinning and transforms instead.');
  });

  eachMatch(text, /\beval\s*\(/g, (m, line) =>
    report(file, line, 'error', 'eval',
      '`eval` blocks CSP and defeats optimisation.',
      'Remove it.'));

  eachMatch(text, /document\.write\s*\(/g, (m, line) =>
    report(file, line, 'error', 'document-write',
      '`document.write` after parse wipes the document.',
      'Create nodes and append them.'));

  eachMatch(text, /console\.(log|debug)\s*\(/g, (m, line) =>
    report(file, line, 'warn', 'console',
      'Debug logging left in production code.',
      'Strip it at build time, or gate it behind a debug flag.'));

  eachMatch(text, /will-change\s*:\s*([^;'"`]+)/gi, (m, line) => {
    if (m[1].split(',').length > 2) {
      report(file, line, 'warn', 'will-change-budget',
        'More than two properties promoted to their own layer.',
        'Animate one or two properties; let the rest composite normally.');
    }
  });

  const contexts = (text.match(/getContext\(\s*['"]webgl2?['"]/g) || []).length;
  if (contexts > 2) {
    report(file, 1, 'error', 'webgl-contexts',
      `${contexts} WebGL contexts requested in one file.`,
      'Reuse one host per page; browsers cap live contexts at ~8-16 and evict the oldest.');
  }

  const observers = (text.match(/new\s+IntersectionObserver/g) || []).length;
  if (observers > 6) {
    report(file, 1, 'warn', 'observer-count',
      `${observers} IntersectionObservers.`,
      'Share one observer for reveals; one more for sticky/pin states.');
  }

  if (/setInterval\s*\(\s*(?:\(\s*\)\s*=>|function)[\s\S]{0,240}?requestAnimationFrame/.test(text)) {
    report(file, 1, 'error', 'raf-in-interval',
      '`requestAnimationFrame` scheduled from `setInterval` fights the compositor.',
      'Drive the loop from rAF alone and read elapsed time inside it.');
  }

  if (/setInterval\s*\(/i.test(text) && !/clearInterval/.test(text)) {
    report(file, 1, 'warn', 'interval-cleanup',
      '`setInterval` with no `clearInterval`.',
      'Clear it on destroy, or drive the work from rAF instead.');
  }
}

/* ------------------------------------------------------------------- html */

function auditHtml(file, text) {
  if (/<html(?![^>]*\blang=)/i.test(text)) {
    report(file, 1, 'error', 'html-lang',
      '`<html>` has no `lang` attribute.',
      'Add `lang="en"` (or the real language) so screen readers use the right voice.');
  }

  if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?!\.\d*[1-9])/i.test(text)) {
    report(file, 1, 'error', 'zoom-locked',
      'The viewport meta blocks zoom.',
      'Use `width=device-width, initial-scale=1` only. Zoom is an accessibility requirement.');
  }

  eachMatch(text, /<canvas\b[^>]*>/gi, (m, line) => {
    if (/aria-hidden/i.test(m[0])) return;
    report(file, line, 'warn', 'canvas-label',
      '<canvas> is not marked `aria-hidden`.',
      'Decorative canvases get `aria-hidden="true"` and `pointer-events: none`.');
  });

  eachMatch(text, /<img\b[^>]*>/gi, (m, line) => {
    const tag = m[0];
    if (!/\bwidth=/.test(tag) || !/\bheight=/.test(tag)) {
      report(file, line, 'warn', 'img-dimensions',
        '<img> without width/height reserves no space and shifts the layout.',
        'Add intrinsic `width`/`height` (plus `height: auto` in CSS).');
    }
    if (/loading\s*=\s*["']lazy["']/i.test(tag) && /hero|banner|cover|above/i.test(tag)) {
      report(file, line, 'error', 'lazy-hero',
        'Above-the-fold image is lazy-loaded, so the LCP element waits.',
        'Remove `loading="lazy"` and add `fetchpriority="high"`.');
    }
  });

  eachMatch(text, /<a\b[^>]*target\s*=\s*["']_blank["'][^>]*>/gi, (m, line) => {
    if (/rel\s*=\s*["'][^"']*noopener/i.test(m[0])) return;
    report(file, line, 'warn', 'target-blank',
      '`target="_blank"` without `rel="noopener"`.',
      'Add `rel="noopener noreferrer"`.');
  });

  eachMatch(text, /\son(?:click|mouseover|mouseenter|focus|change|input)\s*=/gi, (m, line) =>
    report(file, line, 'warn', 'inline-handler',
      'Inline event handler attribute.',
      'Bind with addEventListener; inline handlers break CSP and event delegation.'));

  const h1 = (text.match(/<h1\b/gi) || []).length;
  if (h1 === 0) {
    report(file, 1, 'warn', 'no-h1', 'No `<h1>` on the page.', 'Every page needs one, and only one.');
  } else if (h1 > 1) {
    report(file, 1, 'warn', 'multi-h1', `${h1} \`<h1>\` elements.`, 'Demote the others to `<h2>`.');
  }

  if (!/<title>[^<]+<\/title>/i.test(text)) {
    report(file, 1, 'warn', 'title', 'Missing or empty `<title>`.', 'Write a real 50-60 character title.');
  }

  if (!/<meta[^>]+name\s*=\s*["']description["']/i.test(text)) {
    report(file, 1, 'warn', 'meta-description', 'No meta description.', 'Add a 140-160 character summary.');
  }

  if (/style\s*=\s*["'][^"']*transition\s*:\s*all/i.test(text)) {
    report(file, 1, 'error', 'transition-all', 'Inline `transition: all`.', 'Name the properties.');
  }
}

/* ------------------------------------------------------------------ sizes */

function auditSizes(file, size, ext) {
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    return { kind: 'js', raw: size };
  }
  if (ext === '.css') return { kind: 'css', raw: size };
  if (ext === '.html' || ext === '.htm') return { kind: 'html', raw: size };
  if (ASSET_EXT.has(ext)) return { kind: 'asset', raw: size };
  return null;
}

/* ------------------------------------------------------------------- main */

const { roots, flags } = parseArgs(process.argv.slice(2));
const files = [];
for (const root of roots) await walk(resolve(root), files);

const byKind = { js: 0, css: 0, html: 0, asset: 0 };
let gzipJs = 0;
let gzipCss = 0;

for (const file of files) {
  const ext = extname(file.path).toLowerCase();
  const kind = auditSizes(file.path, file.size, ext);
  if (!kind) continue;
  byKind[kind.kind] += 1;

  if (kind.kind === 'js' && file.size > 4 * 1024) gzipJs += gzipSync(await readFile(file.path)).length;
  if (kind.kind === 'css' && file.size > 2 * 1024) gzipCss += gzipSync(await readFile(file.path)).length;

  if (kind.kind === 'js' && file.size > 180 * 1024) {
    report(file.path, 1, file.size > 400 * 1024 ? 'error' : 'warn', 'js-weight',
      `${(file.size / 1024).toFixed(0)}KB of JavaScript in one file.`,
      'Split it, or drop the animation library and use the skill runtime (~12KB).');
  }

  if (kind.kind === 'css' && file.size > 120 * 1024) {
    report(file.path, 1, 'warn', 'css-weight',
      `${(file.size / 1024).toFixed(0)}KB of CSS in one file.`,
      'Purge unused component CSS; ship per-page sheets.');
  }

  if (kind.kind === 'asset' && file.size > 400 * 1024) {
    report(file.path, 1, file.size > 1200 * 1024 ? 'error' : 'warn', 'asset-weight',
      `${(file.size / 1024 / 1024).toFixed(1)}MB asset.`,
      'Compress to AVIF/WebP at the largest size actually rendered, and serve responsive widths.');
  }

  if (!CODE_EXT.has(ext)) continue;

  const text = await readFile(file.path, 'utf8');
  const shown = relative(process.cwd(), file.path) || file.path;

  if (ext === '.css') auditCss(shown, text);
  else if (ext === '.js' || ext === '.mjs' || ext === '.cjs') auditJs(shown, text);
  else if (ext === '.html' || ext === '.htm') auditHtml(shown, text);
}

// Project-level: motion anywhere on the site needs an escape hatch somewhere.
if (project.cssAnimates && !project.hasReducedMotion) {
  report(roots[0], 1, 'error', 'no-reduced-motion',
    project.infinite
      ? 'The site runs infinite animations and no stylesheet defines `prefers-reduced-motion`.'
      : 'The site animates and no stylesheet defines `prefers-reduced-motion`.',
    'Add the reduced-motion block from references/08-accessibility.md to the last sheet.');
}

const errors = findings.filter((f) => f.severity === 'error');
const warnings = findings.filter((f) => f.severity === 'warn');

if (flags.json) {
  console.log(JSON.stringify({
    roots,
    files: files.length,
    sizes: { js: byKind.js, css: byKind.css, html: byKind.html, assets: byKind.asset, gzipJs, gzipCss },
    errors: errors.length,
    warnings: warnings.length,
    findings,
  }, null, 2));
} else {
  console.log(`\n${paint(C.bold, 'ui-motion audit')}  ${paint(C.dim, roots.map((r) => relative(process.cwd(), resolve(r)) || r).join(', '))}`);
  console.log(paint(C.dim, `scanned ${files.length} files · ${byKind.js} js · ${byKind.css} css · ${byKind.html} html · ${byKind.asset} assets`));

  if (findings.length) {
    const grouped = new Map();
    for (const f of findings) {
      if (!grouped.has(f.file)) grouped.set(f.file, []);
      grouped.get(f.file).push(f);
    }

    for (const [file, list] of grouped) {
      console.log(`\n${paint(C.cyan, file)}`);
      for (const f of list.sort((a, b) => a.line - b.line)) {
        const tag = f.severity === 'error' ? paint(C.red, 'error') : paint(C.yellow, ' warn');
        console.log(`  ${tag}  ${paint(C.dim, `${f.line}:`)} ${f.message}`);
        console.log(`         ${paint(C.dim, `rule ${f.rule} — ${f.fix}`)}`);
      }
    }
  }

  const verdict = errors.length
    ? paint(C.red, `${errors.length} error${errors.length === 1 ? '' : 's'}`)
    : paint(C.green, 'no errors');
  console.log(`\n${paint(C.bold, 'Summary')}  ${verdict}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`);
  console.log(paint(C.dim, `gzip: js ${(gzipJs / 1024).toFixed(1)}KB · css ${(gzipCss / 1024).toFixed(1)}KB  (budget 180KB / 60KB)`));
  console.log('');
}

const failed = errors.length > 0 || (flags.strict && warnings.length > 0);
process.exit(failed ? 1 : 0);
