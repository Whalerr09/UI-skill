# 03 — Scroll and timeline

Scroll is the only timeline the visitor controls. Everything here exists to make that feel
inevitable rather than triggered.

---

## 1. Architecture: one engine, many consumers

Never attach a scroll listener per component. One engine reads scroll state once per frame
and publishes it; consumers only read.

```js
// scroll.js — the only scroll listener on the page
const state = { y: 0, progress: 0, velocity: 0, dir: 1 };
let queued = false;

addEventListener('scroll', () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(frame);
}, { passive: true });

function frame() {
  queued = false;
  const y = scrollY;
  const v = y - state.y;
  state.dir = v > 1 ? 1 : v < -1 ? -1 : state.dir;
  state.y = y;
  state.velocity = v;

  const max = document.documentElement.scrollHeight - innerHeight;
  state.progress = max > 0 ? y / max : 0;

  document.documentElement.style.setProperty('--scroll-y', y);
  document.documentElement.style.setProperty('--scroll-p', state.progress.toFixed(4));
  document.documentElement.dataset.scrollDir = state.dir > 0 ? 'down' : 'up';
  document.documentElement.classList.toggle('is-scrolled', y > 24);

  emit();
}
```

Consumers subscribe:

```js
onScroll((s) => {
  // read only; write via transform/custom properties
});
```

Why this shape:

- `passive: true` — the browser never waits on the handler before scrolling.
- rAF coalescing — at most one read per painted frame, no matter how many scroll events fire.
- Writes go to custom properties on `documentElement`, so CSS can consume them without any
  JS in the render path.
- No `getBoundingClientRect` inside the handler. Cache rects on `resize`/`ResizeObserver`.

---

## 2. The three scroll registers

| Register | Range | What lives here |
| --- | --- | --- |
| **Global** | 0 → 1 across the document | Progress bar, nav state, backdrop hue shift |
| **Section** | 0 → 1 while a section is in view | Parallax layers, pinned narratives, scrim opacity |
| **Element** | 0 → 1 while an element crosses the viewport | Image scale, caption slide, figure fade |

Global is free (one division). Section and element registers need a rect, so compute the
rect only when the section intersects:

```js
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) rects.set(e.target, e.target.getBoundingClientRect());
    active.set(e.target, e.isIntersecting);
  }
}, { rootMargin: '20% 0px 20% 0px' });
```

Then, inside the frame, map to a 0–1 value:

```js
function sectionProgress(rect) {
  // 0 when the section's top hits the viewport bottom
  // 1 when its bottom hits the viewport top
  return clamp((innerHeight - rect.top) / (innerHeight + rect.height), 0, 1);
}
```

---

## 3. Pinning without scroll-jacking

Use `position: sticky`. Never intercept wheel/touch to move the page yourself.

```html
<section class="story">
  <div class="story__pin">
    <div class="story__stage"><!-- visuals --></div>
    <ol class="story__steps"><!-- copy --></ol>
  </div>
</section>
```

```css
.story { height: 320vh; }          /* 3 screens of scroll for 1 pinned screen */
.story__pin {
  position: sticky; top: 0; height: 100svh;
  display: grid; grid-template-columns: 1.1fr .9fr;
  align-items: center;
}
```

Drive the narrative from the section's progress:

```js
const p = sectionProgress(rect);          // 0 → 1
const step = Math.min(Math.floor(p * steps.length), steps.length - 1);
if (step !== current) setStep(step);       // only write when it changes
stage.style.setProperty('--p', p.toFixed(4));
```

Rules:

- One pinned section per page. Two is a slideshow.
- Keep the pin height at 2.5–4× the viewport. Longer than 5 screens and users bail.
- `100svh` (small viewport height), not `100vh`, or mobile browser chrome causes a jump.
- Never pin an element taller than the viewport.
- Under reduced motion, drop `position: sticky` and render every step stacked.

```css
@media (prefers-reduced-motion: reduce) {
  .story { height: auto; }
  .story__pin { position: static; height: auto; }
  .story__steps li { opacity: 1 !important; }
}
```

---

## 4. Hero exit choreography

The most under-built moment on most sites. When the visitor scrolls past the hero, the
elements should *stand down* in order — not vanish as one block, and not stay static while
their parent slides away.

Pattern: map scroll 0 → 1 over the hero's height, then give each element a window.

```js
const seq = [
  { el: preview,  at: 0.00, span: 0.26, blur: 10 },  // large flat plane: goes early, blurs
  { el: cue,      at: 0.10, span: 0.30, shift: true },
  { el: chipA,    at: 0.20, span: 0.30, shift: true },
  { el: chipB,    at: 0.30, span: 0.30, shift: true },
  { el: chipC,    at: 0.40, span: 0.30, shift: true },
  { el: chapters, at: 0.60, span: 0.30 },
  { el: sideNote, at: 0.70, span: 0.30 }
];

function apply(p) {
  for (const item of seq) {
    const t = clamp((p - item.at) / item.span, 0, 1);
    const e = t * t * (3 - 2 * t);                     // smoothstep
    item.el.style.opacity = String(1 - e);
    item.el.style.transform = item.shift
      ? `translate3d(0, ${-e * 18}px, 0)`
      : '';
    if (item.blur) item.el.style.filter = `blur(${e * item.blur}px)`;
  }
}
```

Non-obvious rules that make this read well:

- **Only write when scroll leaves zero**, and hand everything back at `p === 0`. Otherwise
  the inline `opacity` pre-empts the page's own entrance reveal on load.
- **Do not stagger a parent and its children.** If `.chapters` shifts, its chips are carried
  twice. Pick one level.
- **Large flat planes exit early with blur.** A slow fade just dims them in place; a blur
  says the page is letting go.
- **An element whose transform is its centring** (`translateY(-50%)`) must not be animated
  with a competing transform. Move it with a wrapper or an inner element.

---

## 5. Parallax

```css
.parallax {
  will-change: transform;
  transform: translate3d(0, calc(var(--scroll-y) * -0.08px), 0);
}
```

Rules:

- Coefficient 0.03–0.12. Above 0.15 it reads as broken layout rather than depth.
- Parallax the *background layer only*. Text that moves independently of its container
  causes motion sickness and breaks selection.
- Cap total displacement to ~15% of the viewport height.
- Disable below 768px and under reduced motion — the payoff is nil and the jank is real.

For a layered scene, give each layer a different coefficient and keep the whole stack inside
one `overflow: hidden` frame:

```css
.layer--back  { transform: translate3d(0, calc(var(--scroll-y) * -0.04px), 0) scale(1.06); }
.layer--mid   { transform: translate3d(0, calc(var(--scroll-y) * -0.09px), 0) scale(1.03); }
.layer--front { transform: translate3d(0, calc(var(--scroll-y) * -0.16px), 0); }
```

The `scale` on back layers hides the edge gap that parallax inevitably creates.

---

## 6. Scroll-linked CSS, natively

Use it where support allows, with the JS engine as the fallback:

```css
@supports (animation-timeline: scroll()) {
  .progress-bar {
    transform-origin: 0 50%;
    animation: grow linear;
    animation-timeline: scroll(root block);
  }
  @keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
}
```

```css
@supports (animation-timeline: view()) {
  .figure img {
    animation: settle linear both;
    animation-timeline: view();
    animation-range: entry 0% cover 40%;
  }
  @keyframes settle { from { transform: scale(1.12); } to { transform: scale(1); } }
}
```

Caveat: `animation-timeline` values cannot be read by JS, and they ignore easing by design
(the scroll position is the easing). Use them for simple mappings; keep the JS engine for
anything that needs to coordinate several elements or trigger class changes.

---

## 7. Sticky nav

```js
// one sentinel, not a scroll comparison against a hardcoded number
new IntersectionObserver(([e]) => {
  nav.classList.toggle('stuck', !e.isIntersecting);
}, { threshold: 1 }).observe(document.querySelector('#top-sentinel'));
```

Hide on scroll-down, reveal on scroll-up:

```js
let last = 0;
onScroll(({ y, dir }) => {
  if (y < 200) { nav.classList.remove('hide'); last = y; return; }
  if (Math.abs(y - last) < 6) return;          // ignore jitter
  nav.classList.toggle('hide', dir > 0 && y > last);
  last = y;
});
```

```css
.nav { transition: transform .55s var(--ease); }
.nav.hide { transform: translate3d(0, -101%, 0); }
```

Two traps:

1. **Sit the blur on a child, not the bar.** `backdrop-filter` makes an element the
   containing block for its `position: fixed` descendants. If the bar holds a mobile menu
   sheet, the sheet is then measured against the bar instead of the viewport.
2. **Use `100%` of the layout viewport, not `right: 0`,** if the page can overflow
   horizontally. A fixed element resolves against the initial containing block, which grows
   with any horizontal overflow and pushes the burger off-screen. Write the true width on
   resize (`--vw`) or eliminate the overflow entirely.

---

## 8. Progress and reading position

```html
<div class="progress" aria-hidden="true"><i></i></div>
```

```css
.progress { position: fixed; inset: 0 0 auto; height: 1px; z-index: 70; background: var(--line-soft); }
.progress i {
  display: block; height: 100%; background: var(--accent);
  transform: scaleX(var(--scroll-p, 0)); transform-origin: 0 50%;
}
```

For a table of contents, move a single indicator rather than toggling per-item classes:

```css
.toc-indicator {
  transform: translate3d(0, calc(var(--toc-index) * var(--toc-step)), 0);
  transition: transform .42s var(--ease-out);
}
```

---

## 9. Horizontal scroll inside a vertical page

Acceptable, but only when it degrades cleanly:

```css
.rail {
  display: grid; grid-auto-flow: column; grid-auto-columns: min(78vw, 420px);
  gap: var(--s-5);
  overflow-x: auto; overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  padding-inline: var(--pad);
  scrollbar-width: none;
}
.rail > * { scroll-snap-align: start; }
```

- Native scroll, snap points, hidden scrollbar, visible arrows for discovery.
- Never hijack vertical wheel to scroll the rail horizontally.
- Keyboard: the rail must be focusable (`tabindex="0"`) with a visible label so arrow keys work.

---

## 10. Instrumentation

Log frame time in development, remove before shipping:

```js
let acc = 0, n = 0;
function measure(dt) {
  acc += dt; n++;
  if (n === 120) { console.debug('avg frame', (acc / n).toFixed(1), 'ms'); acc = 0; n = 0; }
}
```

Scrolling must stay under 12ms per frame on a 4× throttled mid-tier phone. If it does not,
the cause is almost always one of: layout read per frame, animating a non-compositor
property, or a shadow/filter on a scrolling container.
