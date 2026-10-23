# ui-motion — an agent skill for websites that feel commissioned

Drop one folder into your agent's skill directory and it stops producing gradient-purple template pages. It produces sites with a palette that holds, masked type that reveals on a curve, one WebGL signature moment that earns its ~8KB, and a performance budget it has to sign off against.

```
  SKILL.md          the operating manual — 14 sections, every rule checkable
  references/       11 deep-dive documents: motion, scroll, WebGL, type, a11y, QA
  assets/           copy-paste CSS / JS / shaders — zero dependencies
  examples/         one complete page, assembled and working
  scripts/audit.mjs static rule audit — fails the build on the things that survive review
```

MIT · no build step · no runtime dependency · Node 18+ only for the installer

---

## Install

### One line

**macOS / Linux**

```bash
curl -fsSL https://raw.githubusercontent.com/Whalerr09/UI-skill/main/install.sh | bash
```

**Windows PowerShell**

```powershell
irm https://raw.githubusercontent.com/Whalerr09/UI-skill/main/install.ps1 | iex
```

That installs the skill folder into `~/.claude/skills/ui-motion` and `~/.qoder/skills/ui-motion`, and tells you what it wrote.

### Via npm (no publish required)

```bash
npx --yes github:Whalerr09/UI-skill install
npx --yes github:Whalerr09/UI-skill install --target cursor --project
npx --yes github:Whalerr09/UI-skill doctor
```

### From a clone

```powershell
git clone https://github.com/Whalerr09/UI-skill.git
cd UI-skill
.\install.ps1                      # Windows
```

```bash
git clone https://github.com/Whalerr09/UI-skill.git
cd UI-skill
./install.sh                       # macOS / Linux
```

### Manual

Copy the folder to the right place. That is the whole installer.

| Agent | Destination | Kind |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/ui-motion/` | folder |
| Qoder | `~/.qoder/skills/ui-motion/` | folder |
| Cursor | `.cursor/rules/ui-motion.mdc` | one file |
| Windsurf | `.windsurf/rules/ui-motion.md` | one file |
| GitHub Copilot | `.github/instructions/ui-motion.instructions.md` | one file |
| Anything else | `AGENTS.md` (append) | one file |

Folder targets get `SKILL.md` + `references/` + `assets/`. Single-file targets get a distilled rule set generated from `SKILL.md`, because the agent cannot follow links into a folder it was not given.

---

## Installer options

```bash
npx --yes github:Whalerr09/UI-skill install [options]

  -t, --target <name>   claude | qoder | cursor | windsurf | copilot | agents  (repeatable)
      --all             every target
      --project         install into the current repo instead of your home
      --link            symlink the source folder (Windows: junction, falls back to copy)
  -f, --force           replace an existing install
      --dest <path>     custom directory (single target)
      --json            machine-readable result

  uninstall · list · doctor · version
```

Copy is the default. It needs no admin rights on Windows and keeps working if you move the repository. Use `--link` while editing the skill itself.

---

## What it changes

**Before**

> "make me a landing page for my coffee subscription"

A hero, three feature cards, a gradient, `transition: all .3s`, everything fading in at once, 400KB of JavaScript, no reduced-motion path.

**After** — the same prompt, with the skill loaded:

- Palette archetype chosen first (Ink & Bone / Graphite & Paper / Sepia & Ember / Night & Azure / Moss & Cream), one accent, six-step neutral ramp.
- Motion level declared (0–3) before any code, then held to it. Level 2 means reveals, masked type, hero exit, one pinned section.
- Type scale in `clamp()`, tracking corrected per size, 60–72ch measure.
- Reveals: one `IntersectionObserver`, `rootMargin: 0px 0px -10% 0px`, 35ms grid stagger capped at 420ms, words at 72ms.
- Hero exit mapped to scroll with `{at, span}` per element and a smoothstep, never a wheel hijack.
- One shader. Paused offscreen, frozen under reduced motion, torn down on `pagehide`.
- `node scripts/audit.mjs ./dist` before hand-off — zero errors, budget printed.

---

## The rules it enforces

```css
--ease-out: cubic-bezier(.16, 1, .3, 1);     /* the signature curve */
--ease:     cubic-bezier(.22, .61, .36, 1);  /* generic UI */
--ease-io:  cubic-bezier(.65, 0, .35, 1);    /* exits */
```

| | |
| --- | --- |
| Entrances | `--ease-out`, 620–900ms, travel 8–40px, scale 0.96 → 1 max |
| Exits | `--ease-io`, 0.6 × the enter duration |
| Stagger | grids 35ms (cap 420ms) · words 72ms · rows 85ms · header→body 120ms |
| Reveals | one observer, fire once, show immediately if already in view |
| Scroll | one passive listener, rAF-coalesced, writes `--scroll-y` / `--scroll-p` |
| Pinning | `position: sticky` at 2.5–4× viewport. Never wheel or touch hijacking |
| WebGL | ≤ 2 contexts, DPR ≤ 2, pause offscreen + hidden tab, one still frame under reduced motion |
| Budget | LCP ≤ 2.0s · CLS ≤ 0.02 · INP ≤ 120ms · JS ≤ 180KB gzip · CSS ≤ 60KB gzip |

`transition: all`, animated layout properties, unbounded `will-change`, missing `:focus-visible`, `user-scalable=no`, lazy hero images and canvases without `aria-hidden` are defects, not preferences.

---

## Audit a build

```bash
node scripts/audit.mjs ./dist
node scripts/audit.mjs ./dist --strict        # warnings fail too
node scripts/audit.mjs ./dist --json
```

Static, dependency-free, exit code 1 on errors. It reads HTML, CSS and JS, and reports file, line, rule and the fix:

```
src/app.css
  error  118: Transition on `height` triggers layout every frame.
         rule transition-layout — Switch to transform/opacity, or animate
         `grid-template-rows` for accordions.
```

Rules cover: `transition: all` · layout properties in transitions · `will-change` sprawl · scroll hijacking · `eval` · `document.write` · rAF inside `setInterval` · console logging in production · WebGL context count · observer count · canvas labelling · image dimensions · lazy LCP images · viewport zoom lock · `outline: none` · `@import` · z-index sprawl · `100vh` · missing `lang`, `<title>`, meta description, single `<h1>` · missing reduced-motion block · JS/CSS/image weight.

---

## Run the reference demo

```bash
npm run demo        # http://localhost:4173/examples/
```

It is ES modules, so it needs a server — any server. The page assembles every asset: preloader, sticky nav with mobile sheet, shader hero with masked words and a staggered exit, counters, bento with a tilt card, gallery, pricing, accordion FAQ, closing CTA — plus grain, vignette and a cursor glow.

Open it, read the source next to the references, then delete it.

---

## What is inside

```
SKILL.md                          the manual the agent works from
references/
  01-design-language.md           surfaces, hairlines, elevation, spacing, 5 palettes
  02-motion-system.md             curves, durations, stagger, reveal contract
  03-scroll-and-timeline.md       one engine, pinning, hero exit, parallax, nav
  04-webgl-and-shaders.md         decision ladder, lifecycle contract, fBm, framing
  05-layout-and-sections.md       nav, 5 hero variants, bento, pricing, FAQ, footer
  06-typography-and-color.md      fluid scale, tracking, pairings, color-mix, contrast
  07-performance-budget.md        budgets, loading order, cheap vs expensive CSS
  08-accessibility.md             reduced motion, semantics, keyboard, ARIA
  09-stack-adapters.md            vanilla, React 19, Next, Astro, Svelte, Vue, Tailwind
  10-qa-checklist.md              the sign-off sheet
  11-prompt-playbooks.md          A-E playbooks and prompt repairs
assets/
  css/tokens.css                  reset, tokens, 5 palettes, primitives
  css/motion.css                  reveals, masks, micro-interactions, reduced motion
  css/sections.css                every section pattern
  js/reveal.js                    splitWords, initReveal, initCounters
  js/scroll.js                    scroll engine, nav, progress, parallax, hero exit, story
  js/pointer.js                   glow, magnetic buttons, tilt — fine pointers only
  js/preloader.js                 session-scoped, watchdogged
  js/gl/ShaderCanvas.js           dependency-free WebGL host, full lifecycle
  js/gl/shaders/aurora.js         fBm aurora field
  js/gl/orb.js                    optional Three.js orb
scripts/audit.mjs                 the rule audit
scripts/serve.mjs                 zero-dependency static server
examples/index.html               everything assembled
bin/ui-skill.mjs                  installer
```

Nothing here imports a framework. `assets/js/*` is plain ES modules; `references/09` shows how to wrap the same contracts in React, Next, Astro, Svelte or Vue, and how to move the tokens into Tailwind v4 `@theme`.

---

## Using it

Once installed, the agent picks the skill up when the task matches — a landing page, a marketing site, a portfolio, a hero animation, a shader background, or "make this look premium".

You can also ask for it directly:

```
Use the ui-motion skill. Build a landing page for a single-origin coffee
subscription. Motion level 2, Sepia & Ember palette, one shader moment in the
hero. Target: LCP under 2s on a mid-range phone.
```

The skill's phase 0 asks for the four decisions that actually determine the result — palette archetype, type pairing, motion level, signature moment — and then holds them. If you skip them, it proposes and proceeds.

---

## Requirements

- Node 18+ for the installer and the audit. The skill itself is Markdown, CSS and ES modules — nothing to build.
- The demo and any shader page need to be served over HTTP, not opened from `file://`.
- Three.js is only needed if you use `assets/js/gl/orb.js`.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Agent never uses the skill | Installed to the wrong home, or a `rules` target where the agent expects a folder | `npx --yes github:Whalerr09/UI-skill doctor` — it lists every copy it can find |
| `install.ps1` blocked by execution policy | PowerShell default on Windows | `powershell -ExecutionPolicy Bypass -File .\install.ps1` |
| Shader page is black | WebGL unavailable, or the canvas is behind an opaque parent | The CSS fallback must already look complete — see `references/04` |
| Reveals never fire | The `.js` class is missing from `<html>` | Add the inline head script: `document.documentElement.classList.add('js')` |
| Layout jumps on mobile | `100vh`, or images without `width`/`height` | `100svh`; intrinsic dimensions — the audit flags both |
| `npx github:` fails | npm cannot clone the repo | Use the one-line installer, or clone and run `install.sh` / `install.ps1` |
| Want it gone | — | `npx --yes github:Whalerr09/UI-skill uninstall --all` |

---

## Origin

The motion values, layering discipline, WebGL lifecycle contract and audit rules were distilled from production work in **ThreeUI Community** — 50 parent components and 111 routes of hand-built scroll choreography, shaders and CSS — then rewritten as stack-neutral rules with the numbers attached.

MIT. Keep `SKILL.md` and `LICENSE` together if you redistribute.

If this saves you a week, star the repo so the next person finds it.
