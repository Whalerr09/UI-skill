---
name: ui-motion
description: Build or restyle websites at award-site quality - layered scroll motion, masked type reveals, WebGL/shader accents, a token-driven CSS system, and a hard performance and accessibility budget. Use when the task is to create a landing page, marketing site, portfolio, product UI, hero/section animation, scroll choreography, shader background, or when an existing site must be made to feel premium and fast.
license: MIT
metadata:
  version: 1.0.0
  stack: vanilla-html, css, javascript, react, nextjs, astro, tailwind
---

# UI Motion — build sites that feel authored, not assembled

This skill turns a one-line request ("make me a landing page for X") into a finished,
shipped page: real art direction, a motion grammar with numbers, layered WebGL where it
earns its cost, and an audited performance budget.

The failure mode this skill exists to prevent:

> A page that is technically complete, uses `transition: all 0.3s ease`, fades in five
> things at once, drops a Three.js scene that never pauses, and looks like every other
> AI-generated site.

Everything below is a rule you can check, not a vibe you have to guess at.

---

## 0. How to read this skill

| File | Load it when |
| --- | --- |
| `references/01-design-language.md` | Choosing palette, spacing, elevation, borders |
| `references/02-motion-system.md` | Writing any transition, reveal, or micro-interaction |
| `references/03-scroll-and-timeline.md` | Scroll-linked motion, pinning, hero exit, nav behaviour |
| `references/04-webgl-and-shaders.md` | Canvas / WebGL / Three.js / GLSL work |
| `references/05-layout-and-sections.md` | Laying out nav, hero, proof, pricing, FAQ, footer |
| `references/06-typography-and-color.md` | Type scale, tracking, measure, contrast, palettes |
| `references/07-performance-budget.md` | Before shipping, or when the page feels heavy |
| `references/08-accessibility.md` | Reduced motion, focus, semantics, canvas fallbacks |
| `references/09-stack-adapters.md` | React / Next / Astro / Svelte / Vue / Tailwind specifics |
| `references/10-qa-checklist.md` | The pre-flight pass — run it every time |
| `references/11-prompt-playbooks.md` | Turning a vague brief into a build sequence |

Copy-paste code lives in `assets/`:

```
assets/css/tokens.css        design tokens + palettes + reset + base type
assets/css/motion.css        reveal engine CSS, masks, micro-interactions
assets/css/sections.css      nav / hero / section / footer scaffolds
assets/js/reveal.js          IntersectionObserver reveal + word split + counters
assets/js/scroll.js          scroll progress variables, lerp, pinned sections
assets/js/pointer.js         magnetic buttons, tilt cards, cursor glow, parallax
assets/js/preloader.js       asset-aware preloader with a real exit
assets/js/gl/ShaderCanvas.js dependency-free fullscreen WebGL host
assets/js/gl/shaders/aurora.js  fBm aurora fragment shader
assets/js/gl/orb.js          Three.js orb (only when geometry is required)
examples/index.html          everything assembled, working
```

`scripts/audit.mjs` statically checks a built folder against the hard rules in this file.
`scripts/serve.mjs` is a zero-dependency static server for the demo (`npm run demo`).
`bin/ui-skill.mjs` installs this folder into an agent; `install.ps1` and `install.sh` wrap it.

---

## 1. Operating principles

1. **One idea per viewport.** A hero gets one signature moment. If two elements compete
   for attention, delete one.
2. **Layout before motion.** Never animate an element whose final position can still move.
   Motion amplifies composition; it cannot rescue it.
3. **Motion is a hierarchy tool.** The eye follows the fastest-moving thing first. Use
   speed, not volume, to say "look here".
4. **The first 400ms is a promise.** Above-the-fold content must be readable before any
   WebGL, font, or animation code executes.
5. **Cheap by construction.** Prefer CSS transforms, `clip-path`, gradients, and masks over
   per-frame canvas work. Reach for WebGL only when the effect is genuinely volumetric,
   per-pixel, or impossible in CSS.
6. **Everything degrades.** Reduced motion, no-JS, weak GPU, 360px wide, keyboard only —
   each is a supported state, not an edge case.
7. **Numbers, not adjectives.** "Smooth" means `cubic-bezier(.16,1,.3,1)` over 900ms.
   "Snappy" means 160ms. If you cannot name the value, you have not decided.

---

## 2. Phase 0 — Lock the brief (5 minutes, do not skip)

Before writing a single line of CSS, write `design-brief.md` at the project root:

```markdown
# <Product> — design brief

Promise:      <one sentence the hero must land>
Audience:     <who, and what they already know>
Feeling:      <three adjectives, no synonyms>
Villain:      <the alternative the visitor is escaping>
Palette:      <archetype from 01-design-language.md>
Type:         <pairing from 06-typography-and-color.md>
Motion level: <0-3 scale, see below>
Signature:    <the one thing people will screenshot>
Sections:     <ordered list, see 05-layout-and-sections.md>
Stack:        <framework + build tool>
Non-goals:    <explicitly out of scope>
```

**Motion level scale** — pick one and stay inside it:

| Level | Name | What ships | When |
| --- | --- | --- | --- |
| 0 | Static | Hover states, focus rings, 120–180ms feedback only | Docs, dashboards, regulated products |
| 1 | Refined | Level 0 + scroll reveals + masked headings + micro-interactions | Most product marketing |
| 2 | Cinematic | Level 1 + hero exit choreography + one shader/CSS-3D layer + parallax | Flagship landing pages |
| 3 | Immersive | Level 2 + pinned scroll narrative + interactive WebGL + cursor field | Award / launch sites |

Going over the chosen level is a defect, not a bonus. A level-1 site with 40 animations
feels cheaper than a level-2 site with 9.

---

## 3. Phase 1 — Art direction

Choose deliberately. The default "AI site" look is a failure signal:

| Signal of a default-looking site | Replace with |
| --- | --- |
| Inter + `#6366f1` on `#0f172a` | A palette archetype from `01-design-language.md` and a real type pairing |
| Symmetric centered hero, 3 cards, 3 icons | Asymmetric hero + one proof artifact (screenshot, metric, quote) |
| `border-radius: 12px` everywhere, `box-shadow: 0 4px 6px rgba(0,0,0,.1)` | 0.5px hairlines, one soft layered shadow, radius from a 4-step scale |
| Uniform 24px gaps | Rhythm from a spacing scale with intentional density changes between sections |
| Emoji as iconography | Inline SVG at a consistent stroke weight, or no icons at all |

Non-negotiable: the page must have **a point of view** — one palette, one type pairing,
one easing signature, one signature moment. Consistency reads as craft.

---

## 4. Phase 2 — Skeleton before decoration

Write the page as unstyled semantic HTML first. Then verify:

- Heading order is `h1` → `h2` → `h3` with exactly one `h1`.
- Every interactive element is a `<button>` or `<a>` — never a `<div>` with `onclick`.
- Sections are `<section>` with an `aria-labelledby` pointing at their heading.
- Images have intrinsic `width`/`height` and non-empty `alt` (or `alt=""` if decorative).
- No text baked into canvas or images without a DOM equivalent.
- Reading the page top-to-bottom with CSS off still tells the whole story.

If the unstyled page is confusing, no amount of motion fixes it.

**Section arc** (adapt, do not always use all):

```
arrival → credibility → mechanism → proof → objection handling → offer → close
hero      logos/stat    how it works  gallery  pricing/faq        CTA    footer
```

Every section after the hero needs a *job*, written in one line as an HTML comment above
it. If you cannot write the job, the section is decoration and should be cut.

---

## 5. Phase 3 — Tokens first, values never

Never type a hex, duration, or radius inline. Everything comes from tokens:

```css
:root {
  /* surface ramp */
  --ink: #05070a; --ink-2: #0a0e12; --ink-3: #12161b;
  /* text ramp */
  --bone: #dfe7e0; --bone-dim: #aab4ad; --muted: #78837c;
  /* accent pair — one hue, two intensities */
  --accent: #e0231c; --accent-hot: #ff5a3c;
  /* hairlines */
  --line: rgba(223,231,224,.13); --line-soft: rgba(223,231,224,.07);
  /* rhythm */
  --pad: clamp(20px, 3.4vw, 56px);
  --gap: clamp(14px, 2.4vw, 40px);
  /* radii */
  --r-xs: 4px; --r-sm: 6px; --r-md: 9px; --r-lg: 14px;
  /* motion */
  --ease: cubic-bezier(.22,.61,.36,1);
  --ease-out: cubic-bezier(.16,1,.3,1);
  --ease-io: cubic-bezier(.65,0,.35,1);
  --dur-1: 180ms; --dur-2: 320ms; --dur-3: 620ms; --dur-4: 900ms;
}
```

Start from `assets/css/tokens.css`. It ships five palette archetypes and a light/dark
scheme switch driven by `data-scheme` and `data-palette` on `<html>`, so a theme change
never requires touching a component.

---

## 6. Phase 4 — Motion, in this order

Build in this sequence; each step depends on the previous one being stable.

1. **Feedback (120–180ms).** Hover, press, focus. No exceptions, no delays.
2. **Entrance (600–1050ms).** Scroll reveals via one IntersectionObserver registry.
3. **Hierarchy (stagger).** 35ms for dense grids, 72ms for words, 85ms for rows.
4. **Transitions between states.** Nav condense, accordion, tab, drawer, modal.
5. **Scroll-linked.** Progress bars, parallax, pinned narrative, hero exit.
6. **Ambient.** Shader, grain, drifting light — always pausable, always last.

The exact numbers, curves, and code contracts are in `references/02-motion-system.md`.
The single most important rule:

> **Animate `transform`, `opacity`, and `filter` only.** Everything else causes layout or
> paint work every frame. `width`, `height`, `top`, `left`, `margin`, `box-shadow` are
> banned from transition lists. If a design demands a size change, animate `scale` or
> `clip-path` instead.

Reveal contract (implemented in `assets/js/reveal.js`):

```html
<h2 data-rv="up">Masked heading</h2>
<div class="grid">
  <article data-rv="up">…</article>   <!-- siblings auto-stagger 85ms -->
</div>
```

- Content is visible with JS disabled: `[data-rv]` only hides under `html.js`.
- One observer for the whole page; each element is unobserved after it fires.
- `prefers-reduced-motion: reduce` → elements are shown instantly, no transform.
- Never set inline `opacity` on a revealing element at rest (it pre-empts the entrance).

---

## 7. Phase 5 — The signature layer

One of these, chosen in the brief, executed well:

| Signature | Cost | Use when |
| --- | --- | --- |
| Masked word-by-word headline reveal | ~0 | Almost always — it is the cheapest premium signal |
| Fullscreen fBm/aurora shader | ~8KB + GPU | Ambient hero behind type, dark palettes |
| Cursor-reactive particle field | ~4KB | Level 3 hero, desktop-first |
| Pinned scroll narrative (sticky + progress) | 0 | Product with a sequence to explain |
| CSS-3D card stack / tilt | 0 | Physical products, collectibles |
| Liquid-metal / glass button | 0 CSS / ~6KB GL | One CTA, never five |

Rules for the signature layer:

- It sits **behind** content and never intercepts pointer events over text
  (`pointer-events: none` on decorative canvases).
- It pauses when offscreen, when the tab is hidden, and when the user prefers reduced motion.
- It has a CSS fallback that already looks intentional (gradient + grain), so a WebGL
  failure is invisible to the visitor.
- It is capped at 2 WebGL contexts per page. Three contexts is a bug.

`assets/js/gl/ShaderCanvas.js` is a dependency-free host that already implements the
DPR clamp, resize observer, visibility pause, context-loss recovery, and teardown.

---

## 8. Phase 6 — Performance is a design constraint

Hard budget for a marketing page (measured on a mid-tier phone, 4x CPU throttle):

| Metric | Budget | How to hold it |
| --- | --- | --- |
| LCP | ≤ 2.0s | Hero text in HTML, font `display: swap`, preload the one hero image |
| CLS | ≤ 0.02 | Intrinsic image sizes, no late-inserted banners, `font-size-adjust` or metric-safe fallback |
| INP | ≤ 120ms | No layout reads in scroll/pointer handlers, work deferred to rAF |
| JS (landing) | ≤ 180KB gzip | No animation library unless it is already in the project |
| CSS | ≤ 60KB gzip | Tokens + utilities, no per-section duplicate rules |
| WebGL contexts | ≤ 2 | One shader host per page where possible |
| Frame time | ≤ 12ms | Animate compositor properties only |

Techniques that matter most, in order of payoff:

1. `content-visibility: auto` + `contain-intrinsic-size` on long lists and offscreen sections.
2. Lazy-mount shaders (`IntersectionObserver` → dynamic `import()`), never at page load.
3. `loading="lazy" decoding="async"` on every below-fold image; `fetchpriority="high"` on the one hero image.
4. `will-change` only on elements about to animate, removed when done — never a global `* { will-change: transform }`.
5. One scroll listener, `{ passive: true }`, rAF-coalesced, writing CSS custom properties.

Full budget detail and profiling recipe: `references/07-performance-budget.md`.

---

## 9. Phase 7 — Accessibility is not a later pass

Every site built with this skill ships:

- `prefers-reduced-motion: reduce` → all travel/fade animations become ≤200ms opacity, shaders
  render a single still frame, parallax and marquees stop.
- Visible `:focus-visible` ring: `2px solid` accent, `2px` offset, never removed without a
  replacement.
- A skip link as the first focusable element.
- Text split into word spans keeps the original string as `aria-label`; the spans are
  `aria-hidden="true"`.
- Decorative canvases: `aria-hidden="true"`, `pointer-events: none`.
- Contrast ≥ 4.5:1 body, ≥ 3:1 for text ≥ 24px or ≥ 19px bold.
- Media with motion > 5s gets a pause control (`<video controls>` or a custom toggle).

Detail: `references/08-accessibility.md`.

---

## 10. Phase 8 — Verify, then ship

Run all three:

```bash
node scripts/audit.mjs ./dist          # static rule audit (this skill)
npx serve ./dist                       # or the project's own preview
```

Then the manual pass from `references/10-qa-checklist.md`:

1. **Widths:** 360, 390, 768, 1024, 1440, 2560. Check for horizontal scroll at every width.
2. **Reduced motion on:** everything readable, nothing hidden, no movement.
3. **JS disabled:** all content visible, no blank reveals.
4. **Keyboard only:** tab through — order is logical, focus is always visible.
5. **Slow 4G + 4x CPU:** the hero is readable before the shader appears.
6. **Tab away and back:** animation resumes exactly once (no duplicated rAF loops).
7. **Console:** zero errors, zero 404s, zero WebGL warnings.

If any of these fail, the page is not done — regardless of how it looks in the demo.

---

## 11. Output contract

When you finish a build, the project must contain:

```
design-brief.md            the decisions, written down
index.html                 semantic, readable with CSS off
styles/tokens.css          the single source of visual truth
styles/layout.css          grid, sections, components
styles/motion.css          transitions, keyframes, reduced-motion block
scripts/main.js            one entry point, ES module
scripts/reveal.js          scroll reveals
scripts/gl/*.js            only if a shader exists
README.md                  how to run, what the signature moment is, what degrades
```

Deliver the `README.md` with a short "what to look at" section — three bullet points
naming the motion, the type pairing, and the performance decision that shaped the page.

---

## 12. Hard rules — memorise these

**Do**

- Pick one easing pair and reuse it everywhere.
- Stagger by *reading order*, not by DOM order.
- Give every exit animation a reason; 60% of the entrance duration is a good default.
- Keep the hairline (0.5px / 1px with low alpha) as the default border.
- Cap total entrance delay at ~420ms regardless of item count.
- Let sections breathe: vertical rhythm changes are what make a page feel expensive.

**Never**

- `transition: all` — it is always a bug.
- Animate `width`, `height`, `top`, `left`, `margin`, `box-shadow`, `filter` on large areas
  per frame.
- Put `backdrop-filter` on an ancestor of a `position: fixed` overlay (it becomes the
  containing block and breaks the overlay's geometry).
- Start a WebGL loop at module scope; it must start from a lifecycle hook.
- Leave a rAF loop, observer, or listener alive after unmount.
- Hide content behind JS without a no-JS fallback.
- Ship more than one full-screen animated background per page.
- Use scroll-jacking (hijacking wheel/touch to move the page yourself).

---

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Animation looks "floaty" | `ease-in-out` on entrances | Use `cubic-bezier(.16,1,.3,1)` (fast out, long settle) |
| Content flashes before reveal | Inline `opacity:0` set by JS after paint | Gate with `html.js` + class added in `<head>` before body parses |
| Fixed nav/modal mis-positioned | Ancestor has `transform`, `filter`, or `backdrop-filter` | Move the overlay outside that ancestor (portal) |
| Jank on scroll | Layout reads in the handler, or animating `top` | Cache rects per frame, animate `transform` |
| Shader renders blurry | Canvas backing size ignores DPR | Size = `clientWidth * min(devicePixelRatio, 2)` |
| Shader keeps running in background | No `visibilitychange` / IO pause | See `assets/js/gl/ShaderCanvas.js` |
| Reveal never fires | Element already in view on load, or `threshold` too high | Fire on init if `rect.top < innerHeight`, use `threshold: .04` |
| Page feels "assembled" | Mixed radii, mixed easings, mixed greys | Collapse to one token set; delete the extra values |
| Text hard to read over imagery | No scrim | Add a directional gradient scrim, not a flat overlay |
| Everything animates at once | No stagger, no hierarchy | Assign each element a role: lead, support, ambient |

---

## 14. License and attribution

MIT. The motion values, layering discipline, and audit rules here are distilled from
production work in this repository (ThreeUI Community). If you redistribute the skill,
keep this file and `LICENSE` together.
