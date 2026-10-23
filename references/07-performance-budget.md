# 07 — Performance budget

A beautiful page that drops frames is a failed page. This document defines the budget, the
measurement, and the specific techniques that keep a motion-heavy site inside it.

---

## 1. The budget

Measure on a mid-tier Android (or DevTools 4× CPU + Slow 4G), not on your laptop.

| Metric | Budget | Fails when |
| --- | --- | --- |
| LCP | ≤ 2.0s | Hero image or webfont is the LCP element and is not prioritized |
| INP | ≤ 120ms | Layout reads in handlers, long tasks from hydration |
| CLS | ≤ 0.02 | No intrinsic image size, font swap without metric override |
| TBT | ≤ 200ms | Shader init or large JS at parse time |
| JS shipped (landing) | ≤ 180KB gzip | A full animation/3D library for one effect |
| CSS shipped | ≤ 60KB gzip | Duplicated per-section rules |
| Fonts | ≤ 2 files, ≤ 90KB total | 5 weights × 3 families |
| Images above fold | ≤ 220KB | Uncompressed PNG hero |
| GPU contexts | ≤ 2 | One canvas per card |
| Frame time while scrolling | ≤ 12ms | Non-compositor animation, per-frame rect reads |
| Long tasks (> 50ms) during scroll | 0 | Counter that recomputes layout per frame |

Write these into `budget.json` at the project root if the team needs CI enforcement.

---

## 2. Loading sequence

The order in which things may block:

```
1. HTML (inline critical tokens + hero markup)
2. tokens.css, layout.css  (render-blocking, small)
3. hero image (fetchpriority=high, preload, correct size)
4. hero font (preload the woff2; display=swap)
5. motion.css              (defer if it only affects below-fold)
6. main.js (type=module, defer)  → reveals, nav, counters
7. shader module           (dynamic import on intersection)
8. everything else         (lazy images, below-fold sections)
```

Nothing on rungs 6–8 may be required for the first paint to look correct.

Critical CSS: inline the tokens and above-the-fold layout (~6–10KB) if the site is
server-rendered and LCP is tight. Do not inline the whole stylesheet.

```html
<link rel="preload" as="image" href="/hero.avif" fetchpriority="high">
<link rel="preload" as="font" type="font/woff2" href="/fonts/display.woff2" crossorigin>
```

---

## 3. Images

```html
<img
  src="/hero-960.avif"
  srcset="/hero-640.avif 640w, /hero-960.avif 960w, /hero-1600.avif 1600w"
  sizes="(max-width: 767px) 100vw, 55vw"
  width="1600" height="1000"
  alt="…"
  fetchpriority="high"
  decoding="async">
```

Rules:

- `width` + `height` always, so the browser reserves space (this is the whole CLS fix).
- `srcset` + `sizes` for anything larger than 400px.
- AVIF first, WebP fallback, JPEG last. One format per `<picture>`, not five.
- Below the fold: `loading="lazy" decoding="async"`.
- Above the fold: **never** `loading="lazy"` — it delays LCP by a full network round trip.
- Decorative images: `alt=""` and `aria-hidden="true"` only if truly decorative.
- Background images cannot be lazy-loaded or sized; use `<img>` with `object-fit` instead.

---

## 4. Runtime CSS performance

### What is cheap

`transform`, `opacity`, `filter` (GPU), `clip-path` (composited on most engines).

### What is expensive

| Property | Why | Alternative |
| --- | --- | --- |
| `width`, `height`, `top`, `left`, `margin`, `padding` | Layout every frame | `transform: scale/translate`, `clip-path` |
| `box-shadow` | Repaint of a large area | Fake with a pseudo-element and animate its opacity |
| `border-radius` on a huge element while animating | Re-rasterization | Keep radius static |
| `background-position` | Paint | `transform` on a child layer |
| `backdrop-filter` | Reads the backdrop each frame | Static tint, or apply only while a small panel is open |
| `filter: blur(40px)` on a full-screen layer | Very expensive on mobile | Pre-blur an image, or use a radial gradient |
| `position: fixed` inside a scroller | Continuous compositing | `sticky` |

### Containment

```css
.long-list > * { content-visibility: auto; contain-intrinsic-size: auto 220px; }
.card         { contain: layout paint; }
.section      { contain: layout style; }
```

`content-visibility: auto` skips rendering offscreen subtrees entirely. On a 200-item grid
this is often a 2–3× scroll improvement. Always pair it with `contain-intrinsic-size` or the
scrollbar jumps as items are measured.

Do not apply it to the hero, to the pinned section, or to anything that must be measured
before it enters the viewport.

### `will-change` discipline

```css
/* correct: scoped, time-limited */
.card:hover { will-change: transform; }
.card.is-animating { will-change: transform, opacity; }
```

Never:

```css
* { will-change: transform; }        /* allocates a layer per element */
.card { will-change: transform; }    /* permanent, even at rest */
```

A compositor layer costs GPU memory (≈ width × height × 4 bytes). 40 promoted elements on a
1440px page can exceed 100MB and crash low-end devices.

Remove the hint when the animation ends — either by dropping the class or by letting the
`:hover` scope expire.

---

## 5. JavaScript performance

| Rule | Detail |
| --- | --- |
| One entry module | Multiple `<script>` tags serialise the parse |
| No per-element listeners in lists | Delegate to the container |
| Passive listeners | `{ passive: true }` for `scroll`, `touchstart`, `wheel` |
| Batch DOM reads, then writes | Reads force layout; interleaving causes thrash |
| Cache rects | `getBoundingClientRect` on resize/IO, not per scroll frame |
| Defer non-critical work | `requestIdleCallback` for instrumentation, analytics |
| Avoid `innerHTML` in loops | Build a fragment, append once |
| Bound arrays | Trails/particles must recycle, not grow |
| `ResizeObserver` over `window.resize` | Fires only for the element, and for layout changes |

Layout thrash, illustrated:

```js
// WRONG — 100 forced layouts
for (const el of items) el.style.width = el.parentElement.clientWidth + 'px';

// RIGHT — read once, write once
const w = container.clientWidth;
for (const el of items) el.style.width = w + 'px';
```

---

## 6. Canvas and WebGL cost

| Knob | Safe default |
| --- | --- |
| Backing resolution | `min(devicePixelRatio, 2)`; `1.5` for particle layers |
| Frame rate | 60 for hero shader; 30 for ambient fields |
| Fragment complexity | ≤ 5 fBm octaves; no texture loops |
| Particles | ≤ 220 for a fullscreen starfield at 1440px; scale with area |
| Contexts | 1 shader host + 1 optional Three.js scene, never more |
| Pause triggers | offscreen, hidden tab, reduced motion, `Save-Data` |

Scale particle counts with area, not a constant:

```js
const count = Math.min(stars.length, Math.round((width * height / 4200) * density));
```

Render nothing while hidden:

```js
if (document.hidden) { cancelAnimationFrame(raf); raf = 0; return; }
```

Guard against double-start, which doubles the loop:

```js
function start() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(render); }
```

---

## 7. Profiling workflow

1. **DevTools → Performance**, record 5 seconds of scroll + a real interaction.
   - Look for long tasks (> 50ms) and "Recalculate Style"/"Layout" inside the frame strip.
   - If layout appears every frame, a scroll handler is reading geometry.
2. **Rendering panel** → enable *Paint flashing* and *Layer borders*.
   - Flashing large areas on scroll = paint-bound. Move to `transform`/`opacity`.
   - Hundreds of layer borders = `will-change` abuse.
3. **Performance monitor** → watch *Layouts/sec* and *GPU memory*.
   - Layouts > 0 while scrolling is a bug.
   - GPU memory climbing steadily = texture/layer leak.
4. **Network** → throttle to Slow 4G, disable cache, reload.
   - The hero must be readable before the shader bundle arrives.
5. **Lighthouse** (mobile preset) → treat anything below 90 as a regression, but judge with
   the numbers in §1, not the score alone.

---

## 8. Anti-patterns and their fixes

| Anti-pattern | Symptom | Fix |
| --- | --- | --- |
| `transition: all .3s` | Unrelated properties animate; jank | List properties explicitly |
| Animating `box-shadow` on a card | Paint every frame | Pseudo-element with `opacity` |
| `backdrop-filter` on a sticky header over a shader | Frame drops on mobile | Static tint at 62% + optional blur only ≥ 1024px |
| Full-screen `filter: blur()` layer | Constant GPU tax | Pre-blurred asset or radial gradient |
| Shader initialised at module scope | LCP + TBT hit before content | Dynamic `import()` on intersection |
| 200 items × `IntersectionObserver` each | Slow init, memory | One observer, `data-` attributes |
| Counter that sets `textContent` on layout-affecting elements | Scroll jank | Fixed-width container, `tabular-nums` |
| Sticky header with `height` transition | Reflow of the whole page | Animate inner padding/scale |
| Hero video autoplay with sound-blocked retry loop | Console noise, battery | `muted playsinline preload="none"` + poster |
| Loading three font families | FOUT flash, CLS | Two families, subset, preload one |

---

## 9. Build hygiene

- **No source maps in production** for public builds (they leak source and add weight).
- **CSS**: one token file, one layout file, one motion file. Minify; do not concatenate
  different components' rules into per-page duplicates.
- **JS**: ES modules, tree-shaken. If the project has no bundler, ship plain modules and let
  the browser split them by import graph.
- **Images**: run an AVIF/WebP pipeline. A 1600×1000 photographic hero should land at
  80–140KB AVIF, not 1.2MB PNG.
- **Cache**: hashed filenames for JS/CSS/images, `Cache-Control: immutable` for a year.
- **Preconnect** only to origins you actually use on the critical path; unused preconnects
  cost DNS time elsewhere.

---

## 10. Sign-off

Do not ship until all of these are true:

- [ ] Lighthouse mobile: LCP ≤ 2.0s, CLS ≤ 0.02, TBT ≤ 200ms.
- [ ] Zero layout recalculations during a scroll recording.
- [ ] Zero long tasks > 50ms while scrolling.
- [ ] Muted-tab CPU usage ≈ 0 (shaders and rAF stopped).
- [ ] The page is readable with JS disabled.
- [ ] Total JS and CSS within budget.
- [ ] Every animated property is `transform`, `opacity`, or `filter`.
- [ ] No permanent `will-change` anywhere.
- [ ] Images all carry `width`/`height`; below-fold is lazy.
- [ ] GPU memory stable after 60 seconds of scrolling.
