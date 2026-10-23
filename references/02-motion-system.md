# 02 — Motion system

The complete motion grammar: curves, durations, distances, stagger, reveal contracts,
masked type, state transitions, and micro-interactions.

Every number here is a decision, not a suggestion. Reuse them so the whole page shares one
physical feel.

---

## 1. Easing

Four curves cover every case. Pick `--ease-out` as the house signature and use it for
anything entering the viewport.

```css
:root {
  --ease-out:  cubic-bezier(.16, 1, .3, 1);     /* signature: fast out, long settle */
  --ease:      cubic-bezier(.22, .61, .36, 1);  /* symmetric, for state changes */
  --ease-io:   cubic-bezier(.65, 0, .35, 1);    /* through-motion: slides, wipes */
  --ease-spring: cubic-bezier(.34, 1.56, .64, 1); /* tiny playful pops only */
}
```

Why `--ease-out` wins for entrances: it spends most of its distance in the first 200ms and
then settles slowly. The element *arrives* immediately and *lands* gracefully — which is
how physical objects behave. `ease-in-out` starts slow, feels unresponsive, and instantly
reads as "web animation".

| Motion | Curve |
| --- | --- |
| Element entering | `--ease-out` |
| Element leaving | `--ease-io` (accelerate away) |
| Hover / colour / opacity | `--ease` |
| Slide, wipe, accordion | `--ease-io` |
| Badge pop, check mark | `--ease-spring`, ≤ 260ms |
| Scroll-linked | `linear` (the scroll position *is* the timeline) |

---

## 2. Durations

```css
:root {
  --dur-0: 120ms;  /* press, focus, checkbox */
  --dur-1: 180ms;  /* hover, icon swap */
  --dur-2: 320ms;  /* nav condense, drawer, tooltip */
  --dur-3: 620ms;  /* card/image entrance */
  --dur-4: 900ms;  /* text reveal, section entrance */
  --dur-5: 1200ms; /* full-screen backdrop, page transition */
}
```

Scaling rules:

- **Duration grows with area, not importance.** A 4px dot at 600ms looks broken; a
  full-bleed image at 600ms looks hasty.
- **Exit = 0.6 × enter**, same curve family. Leaving should feel decisive.
- **Distance and duration move together.** 8px travel → ≤ 300ms. 26px → 700–1000ms.
- **Nothing exceeds 1200ms** except a deliberate curtain transition.
- **No delay over 420ms total** across a group — beyond that it reads as a bug.

| Element | Enter | Exit |
| --- | --- | --- |
| Button press | 120ms | 120ms |
| Icon / chevron | 180ms | 140ms |
| Tooltip, popover | 200ms | 150ms |
| Nav condense / hide | 550ms | 550ms |
| Card in a grid | 620ms | — |
| Paragraph / list row | 720ms | — |
| Heading line | 1050ms | — |
| Single word | 820ms | — |
| Full-screen overlay | 900ms | 600ms |

---

## 3. Distances and scale

```css
:root {
  --travel-xs: 4px;    /* press, hover nudge */
  --travel-sm: 8px;    /* small labels, chips */
  --travel-md: 26px;   /* standard entrance */
  --travel-lg: 56px;   /* large media */
  --mask-travel: 110%; /* line/word mask offset — must exceed the glyph height */
}
```

Rules:

- Entrance travel should be **4–8% of the element's own height**, clamped between 8 and 40px.
  A 900px hero image rising 8px feels effortless; rising 80px feels like a slideshow.
- Never travel more than one full element height for a reveal.
- `scale()` for entrances: `0.96 → 1` maximum. Anything smaller looks like a zoom effect.
- Blur is a *distance* cue, not decoration: `blur(6–12px)` on exit only, and only on large
  flat planes.

---

## 4. Stagger

Stagger is how a group of elements says "I am one thing" while still appearing in an order.

| Group | Stagger | Cap |
| --- | --- | --- |
| Dense grid (cards, gallery, browse) | 35ms | 420ms total |
| Words in a headline | 72ms | 360ms total |
| List rows (features, pricing rows) | 85ms | 510ms |
| Nav links on load | 60ms | 240ms |
| Section header → body → CTA | 120ms | — |

```css
/* deterministic counts, capped — never index * 35ms unbounded */
.grid > * {
  animation: rise 620ms var(--ease-out) both;
  animation-delay: min(calc(var(--i) * 35ms), 420ms);
}
```

Assign `--i` in markup or in the reveal engine — never in a scroll handler (writing a
custom property per scroll frame forces style recalculation).

**Stagger by reading order.** In an LTR grid, that is `row → column`. If the visual order
differs from DOM order, set `--i` explicitly from the visual index.

---

## 5. The reveal engine

One `IntersectionObserver` for the entire page. Every revealing element registers once and
is unobserved after it fires.

```js
const io = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    io.unobserve(entry.target);
    const delay = Number(entry.target.dataset.rvd || 0);
    setTimeout(() => entry.target.classList.add('rv-in'), reduced ? 0 : delay);
  }
}, { rootMargin: '0px 0px -10% 0px', threshold: 0.04 });
```

Contract:

| Rule | Why |
| --- | --- |
| `rootMargin: 0 0 -10% 0` | Fires slightly before the element is fully in view, so motion starts as it enters |
| `threshold: .04` | A 4% sliver is enough; `0.5` makes tall sections fire too late |
| `unobserve` on fire | Avoids re-triggering on scroll-up, which reads as a glitch |
| Show if already in view on init | Above-the-fold elements must not wait for a scroll event |
| Delay from `data-rvd`, not from the observer | Grouping and staggering stay declarative |

### No-JS and no-flash contract

The reveal must never leave content invisible if JS fails, and must never flash content
before hiding it. Add the class **in the head, before the body parses**:

```html
<script>document.documentElement.classList.add('js')</script>
```

```css
[data-rv] { opacity: 1; }                    /* default: visible */
.js [data-rv] { opacity: 0; }
.js [data-rv="up"] { transform: translate3d(0, var(--travel-md), 0); }

.js [data-rv].rv-in {
  opacity: 1;
  transform: none;
  transition: opacity .9s var(--ease-out), transform 1.05s var(--ease-out);
}
```

CSS-only fallback (no observer needed) is acceptable when you only need viewport entry:

```css
@supports (animation-timeline: view()) {
  .rv {
    animation: rise linear both;
    animation-timeline: view();
    animation-range: entry 8% cover 26%;
  }
}
```

---

## 6. Masked type — the cheapest premium signal

Two variants. Both are pure CSS after a one-time DOM split.

### Line mask (headings you author by hand)

```html
<h1 class="display">
  <span class="mask-line"><span>Where stillness</span></span>
  <span class="mask-line"><span>reveals the unseen</span></span>
</h1>
```

```css
.mask-line { display: block; overflow: hidden; }
.mask-line > span {
  display: block;
  transform: translate3d(0, 110%, 0);
  transition: transform 1.05s var(--ease-out);
}
.rv-in .mask-line > span { transform: none; }
/* second line starts 90ms later */
.rv-in .mask-line:nth-child(2) > span { transition-delay: 90ms; }
```

Padding note: descenders (`g`, `y`, `p`) get clipped by `overflow: hidden`. Add
`padding-bottom: .12em; margin-bottom: -.12em` on `.mask-line` so glyphs are not cut.

### Word mask (any heading, split at runtime)

```js
function splitWords(heading) {
  if (heading.dataset.words === 'true') return;
  const phrase = heading.textContent.replace(/\s+/g, ' ').trim();
  if (!phrase) return;
  heading.dataset.words = 'true';
  heading.setAttribute('aria-label', phrase);   // accessible name preserved
  heading.textContent = '';
  phrase.split(' ').forEach((word, i) => {
    if (i) heading.append(' ');
    const mask = document.createElement('span');
    mask.className = 'word-mask';
    mask.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span');
    inner.className = 'word';
    inner.textContent = word;
    inner.style.setProperty('--word-delay', `${i * 72}ms`);
    mask.append(inner);
    heading.append(mask);
  });
}
```

```css
.word-mask { display: inline-block; overflow: hidden; vertical-align: top; }
.word {
  display: inline-block;
  opacity: 0;
  transform: translate3d(0, 112%, 0);
  transition: transform .82s var(--ease-out), opacity .5s var(--ease-out);
  transition-delay: var(--word-delay, 0ms);
}
.word-reveal.rv-in .word { opacity: 1; transform: none; }
```

Rules:

- Skip the split entirely under reduced motion (it adds DOM for no benefit).
- Never split inside a link or a button — the accessible name breaks.
- Cap at ~14 words; beyond that the last word arrives too late to feel connected.
- Keep `will-change: transform, opacity` on `.word` only while the group is animating. On a
  12-word headline it is fine; on 400 list rows it is not.

---

## 7. State transitions

| Pattern | Recipe |
| --- | --- |
| **Nav condense** | `stuck` class from a sentinel observer; background wash fades in over 500ms, hairline appears, height shrinks 84 → 64px |
| **Nav hide** | On scroll-down past 200px: `translate3d(0,-101%,0)` at 550ms; scroll-up returns. Never hide above the fold |
| **Link roll** | Two stacked labels; hover sends the first to `-100%` and the second from `100%` to `0` |
| **Underline** | `transform: scaleX(0) → 1`, `transform-origin: left`, 320ms |
| **Accordion** | `grid-template-rows: 0fr → 1fr` on a wrapper (animatable, no JS height measurement) |
| **Drawer** | `translate3d(100%,0,0)` → `0`, 420ms `--ease-io`, backdrop fades 320ms |
| **Modal** | Backdrop opacity 0→1 320ms; panel `translateY(12px) scale(.98)` → none, 380ms `--ease-out` |
| **Tab switch** | Panel fades 160ms out, 220ms in; indicator uses `translate3d` with measured offset |
| **Toggle** | Knob `translate3d`, track colour via `color-mix`, 220ms `--ease` |
| **Copy button** | Icon swap + label crossfade 160ms; success state holds 1400ms |

Accordion, precisely:

```css
.acc-body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .42s var(--ease-io); }
.acc-body > div { overflow: hidden; }
.acc[open] .acc-body { grid-template-rows: 1fr; }
```

---

## 8. Micro-interactions

Each is small, cheap, and adds perceived quality disproportionate to its code size.

### Button press

```css
.btn { transition: transform 120ms var(--ease), background-color 180ms var(--ease); }
.btn:active { transform: scale(.98); }
```

### Magnetic button (pointer-follow, desktop only)

```js
const strength = 0.22;
btn.addEventListener('pointermove', (e) => {
  const r = btn.getBoundingClientRect();
  const x = (e.clientX - r.left - r.width / 2) * strength;
  const y = (e.clientY - r.top - r.height / 2) * strength;
  btn.style.transform = `translate3d(${x}px, ${y}px, 0)`;
});
btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
```

Only attach when `matchMedia('(hover: hover) and (pointer: fine)').matches`.

### Tilt card

```js
card.style.transform =
  `perspective(900px) rotateX(${-y * 6}deg) rotateY(${x * 8}deg) translateZ(0)`;
```

Keep the maximum at 6–8°, add a moving specular via a `radial-gradient` positioned with
the same coordinates, and reset on `pointerleave`. Never tilt text-only cards — the glyphs
go soft.

### Cursor glow

A single fixed `radial-gradient` layer, moved with `translate3d` inside a rAF, `mix-blend-mode: screen`,
`pointer-events: none`. Lerp toward the pointer at `0.12` per frame so it trails.

### Counter

```js
const start = performance.now();
const ease = (t) => 1 - Math.pow(1 - t, 3);
function tick(now) {
  const t = Math.min((now - start) / 1400, 1);
  el.textContent = Math.round(target * ease(t)).toLocaleString();
  if (t < 1) requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```

Always render the final value in HTML first, then animate from 0 on first intersection —
so a crawler or a no-JS visitor sees `12,400`, not `0`.

### Marquee

Duplicate the track once, animate `translate3d(-50%,0,0)` with `linear infinite`, pause on
`:hover` and on reduced motion. Never use `left` or `margin-left`.

---

## 9. Motion budget

Before shipping, count:

| Item | Limit |
| --- | --- |
| Simultaneously animating elements in one viewport | 12 |
| Transitioned properties per element | 3 |
| Distinct easing curves in the whole project | 4 |
| Distinct durations | 6 |
| rAF loops | 1 scroll + 1 per WebGL surface |
| IntersectionObservers | 1 reveal registry + 1 per WebGL surface |
| Elements with permanent `will-change` | 0 |
| Animations over 1200ms | 0 (unless a deliberate curtain) |

A page with 40 animated elements and one easing curve feels more expensive than one with
400 and six curves. Restraint is the differentiator.

---

## 10. Reduced motion

One block, at the bottom of the motion stylesheet, resets everything:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
  [data-rv], .js [data-rv] { opacity: 1 !important; transform: none !important; }
  .word, .mask-line > span { transform: none !important; opacity: 1 !important; }
}
```

That global reset is a safety net, not the whole answer. Also:

- Read the preference in JS (`matchMedia`) so shaders, parallax, and marquees stop rather
  than merely transitioning instantly.
- Listen for `change` — a user can flip the OS setting while the page is open.
- Do not replace motion with nothing: keep a 150–200ms opacity fade so state changes are
  still legible.
