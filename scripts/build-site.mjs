#!/usr/bin/env node
/**
 * build-site.mjs — assemble the GitHub Pages site into `_site/`.
 *
 *   BASE_PATH=/UI-skill node scripts/build-site.mjs
 *
 * Three things, no bundler, no dependencies:
 *   1. the skill payload, so /examples/ resolves its relative imports
 *   2. the reference demo, verbatim
 *   3. a landing page written with the skill's own tokens and motion system —
 *      the link in the README is proof of what the skill produces, not a promise
 */

import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '_site');
const BASE = process.env.BASE_PATH || '/UI-skill';
const SKILL = 'skills/ui-motion';

const LANDING = /* html */ `<!DOCTYPE html>
<html lang="en" data-scheme="dark" data-palette="ink">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>ui-motion — the agent skill for websites that feel commissioned</title>
<meta name="description" content="Layered scroll motion, masked type reveals, WebGL accents, token-driven CSS and a hard performance budget, packaged as an installable skill for Claude Code, Qoder, Cursor and friends.">
<meta name="theme-color" content="#05070a">
<link rel="icon" href="__BASE__/assets/logo-icon.png" type="image/png">
<script>document.documentElement.classList.add('js');</script>
<link rel="stylesheet" href="__BASE__/__SKILL__/assets/css/tokens.css">
<link rel="stylesheet" href="__BASE__/__SKILL__/assets/css/motion.css">
<style>
  .hero {
    min-height: 100svh; display: grid; align-content: center;
    padding: calc(var(--nav-h) + var(--s-8)) var(--pad) var(--s-8);
    position: relative; overflow: hidden;
  }
  .hero::before {
    content: ""; position: absolute; inset: -20% -10% auto; height: 70%;
    background: radial-gradient(50% 60% at 30% 40%, var(--accent-soft), transparent 70%);
    filter: blur(20px); pointer-events: none;
  }
  .hero__inner { position: relative; max-width: 68ch; display: grid; gap: var(--s-5); }
  .keys { display: grid; gap: var(--s-3); }
  .key {
    display: block; padding: var(--s-4) var(--s-5); border-radius: var(--r-md);
    border: 0.5px solid var(--line); background: var(--surface);
    font-family: var(--font-mono); font-size: var(--t-xs); line-height: 1.7;
    color: var(--fg-muted); overflow-x: auto; white-space: pre;
  }
  .key b { color: var(--fg); font-weight: 500; }
  .split { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(340px, 100%), 1fr)); gap: var(--gap); }
</style>
</head>
<body>

<main id="main">
  <section class="hero" aria-labelledby="top-title">
    <div class="hero__inner">
      <p class="eyebrow" data-rv="fade">
        <span style="width:5px;height:5px;border-radius:50%;background:var(--accent);box-shadow:0 0 10px var(--accent)"></span>
        Agent skill · MIT · zero dependencies
      </p>

      <h1 id="top-title" data-rv="words" style="font-size:var(--t-display);letter-spacing:-.03em;max-width:18ch;margin:0">
        Make the page feel commissioned
      </h1>

      <p class="lede" data-rv="up">
        One skill folder. Your agent gets palette discipline, a motion grammar with numbers,
        a WebGL lifecycle contract, and an audit that fails the build when any of it slips.
      </p>

      <div data-rv="up" style="display:flex;gap:var(--s-4);flex-wrap:wrap">
        <a class="btn btn--fill btn--lg" href="__BASE__/examples/">See the reference build</a>
        <a class="btn btn--ghost btn--lg" href="https://github.com/Whalerr09/UI-skill">Install it</a>
      </div>
    </div>
  </section>

  <section class="section" style="padding-block:var(--s-8)" aria-labelledby="install-title">
    <div class="container split">
      <div data-rv="up">
        <h2 id="install-title" style="font-size:var(--t-h2);letter-spacing:-.018em;margin-bottom:var(--s-4)">Install in one line</h2>
        <div class="keys">
          <code class="key"><b>bash</b>  curl -fsSL __RAW__/install.sh | bash</code>
          <code class="key"><b>ps1 </b>  irm __RAW__/install.ps1 | iex</code>
          <code class="key"><b>npx  </b>  npx --yes github:Whalerr09/UI-skill install --all</code>
          <code class="key"><b>clau</b>  claude plugin marketplace add Whalerr09/UI-skill
<b>    </b>  claude plugin install ui-skill@ui-motion</code>
        </div>
      </div>

      <div data-rv="up">
        <h2 style="font-size:var(--t-h2);letter-spacing:-.018em;margin-bottom:var(--s-4)">The numbers</h2>
        <p class="muted" style="font-size:var(--t-sm);line-height:1.65">
          Entrances ride <code>cubic-bezier(.16,1,.3,1)</code> at 620–900ms with 8–40px of travel.
          Words land 72ms apart, grid cells 35ms, capped at 420ms. One scroll listener writes
          <code>--scroll-y</code> and every consumer reads it instead of measuring. One shader,
          two contexts maximum, DPR clamped at 2, paused offscreen, frozen to a still frame
          under reduced motion.
        </p>
        <p class="muted" style="font-size:var(--t-sm);line-height:1.65;margin-top:var(--s-3)">
          Budget: LCP ≤ 2.0s · CLS ≤ 0.02 · INP ≤ 120ms · JS ≤ 180KB gzip · CSS ≤ 60KB.
          This page and the reference build above ship 17KB of JavaScript and 10KB of CSS.
        </p>
      </div>
    </div>
  </section>
</main>

<footer style="border-top:1px solid var(--line-soft);padding-block:var(--s-6)">
  <div class="container" style="display:flex;gap:var(--s-4);flex-wrap:wrap;align-items:center;justify-content:space-between;font-size:var(--t-xs);color:var(--fg-faint)">
    <span style="display:inline-flex;align-items:center;gap:var(--s-3)">
      <img src="__BASE__/assets/logo-icon.png" alt="Whale Devs" width="22" height="22">
      ui-motion · MIT · Whale Devs
    </span>
    <a href="https://github.com/Whalerr09/UI-skill" style="color:var(--fg-muted)">github.com/Whalerr09/UI-skill</a>
  </div>
</footer>

<div class="grain" aria-hidden="true"></div>
<div class="vignette" aria-hidden="true"></div>

<script type="module">
  import { mountMotion } from '__BASE__/__SKILL__/assets/js/reveal.js';
  mountMotion();
</script>
</body>
</html>
`;

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

// The demo imports the skill by relative path, so the payload goes with it.
await cp(join(ROOT, 'examples'), join(OUT, 'examples'), { recursive: true });
await cp(join(ROOT, SKILL, 'assets'), join(OUT, SKILL, 'assets'), { recursive: true });
await cp(join(ROOT, 'assets'), join(OUT, 'assets'), { recursive: true });

const html = LANDING
  .replaceAll('__BASE__', BASE)
  .replaceAll('__SKILL__', SKILL)
  .replaceAll('__RAW__', 'https://raw.githubusercontent.com/Whalerr09/UI-skill/main');

await writeFile(join(OUT, 'index.html'), html, 'utf8');

const entries = await readdir(OUT);
console.log(`built ${OUT}\ntop level: ${entries.join(', ')}`);
