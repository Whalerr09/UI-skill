# 05 — Layout and sections

Nine section archetypes, each with a job, a grid, a motion idea, and the specific bug it
tends to ship with. Assemble a page by picking one per role — do not use the same recipe
twice in a row, and do not invent a grid you cannot defend.

---

## 0. Page shell

```html
<html lang="en" data-scheme="dark" data-palette="ink">
<head>
  <script>document.documentElement.classList.add('js')</script>
  <link rel="stylesheet" href="/styles/tokens.css">
  <link rel="stylesheet" href="/styles/layout.css">
  <link rel="stylesheet" href="/styles/motion.css">
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <div id="top-sentinel" aria-hidden="true"></div>
  <header class="nav">…</header>
  <main id="main">
    <section class="hero" aria-labelledby="hero-title">…</section>
    …
  </main>
  <footer class="foot">…</footer>
  <div class="grain" aria-hidden="true"></div>
  <div class="vignette" aria-hidden="true"></div>
  <script type="module" src="/scripts/main.js"></script>
</body>
</html>
```

Shell rules:

- Content wrapper is one `<main>`. Never nest `<main>`.
- Overlays (grain, vignette, modal root, preloader) are direct children of `<body>` so no
  parent stacking context or transform can trap them.
- Grid and gutter come from one place: `--pad` for horizontal, `--s-9` for section rhythm.
- `scroll-behavior: auto` by default. Smooth scrolling is a motion decision, not a default —
  enable it only for anchor navigation and disable it under reduced motion.

---

## 1. Nav

**Job:** never compete with the hero; be instantly available on scroll-up.

```html
<header class="nav">
  <a class="brand" href="/">…</a>
  <nav class="nav__links" aria-label="Primary">
    <a class="nav-link" href="/work"><span>Work</span><span class="alt">Work</span></a>
  </nav>
  <a class="btn btn--ghost" href="/start">Start</a>
</header>
```

```css
.nav {
  position: fixed; inset: 0 0 auto; z-index: 50;
  display: flex; align-items: center; gap: var(--s-5);
  height: 84px; padding: 0 var(--pad);
  transition: transform .55s var(--ease), height .35s var(--ease);
}
.nav::before {                      /* the wash lives on a child, never the bar */
  content: ''; position: absolute; inset: 0; z-index: -1;
  background: color-mix(in oklab, var(--ink) 62%, transparent);
  backdrop-filter: blur(14px) saturate(1.1);
  opacity: 0; transition: opacity .5s linear;
}
.nav.stuck::before { opacity: 1; }
.nav.stuck { height: 64px; }
```

Motion: link roll on hover (two stacked labels), wash fades in after 24px, hide on
scroll-down past 200px. Active link gets a 1px accent rule, not a pill.

Gotchas:

- `backdrop-filter` on the bar makes it the containing block for any `position: fixed`
  descendant (the mobile sheet). Keep the blur on `::before`.
- Do not animate `height` on the bar if it contains absolutely positioned menus keyed to its
  height; use `padding` or transform the inner content instead.
- Mobile: one `<button aria-expanded>` toggling a `<div hidden>` sheet. Never a `<div onclick>`.

---

## 2. Hero

**Job:** land the promise in under 2 seconds, then offer exactly one next action.

Five variants. Pick by product, not by taste.

| Variant | Grid | Works for | Signature motion |
| --- | --- | --- | --- |
| **Editorial left** | 46% text / 54% artifact, top-aligned, huge display type | Culture, luxury, AI | Masked word reveal + slow artifact parallax |
| **Centered manifesto** | single column, `max-width: 22ch` headline | Infrastructure, dev tools | Line-by-line mask, blinking cursor in a code block |
| **Split product** | 50/50, UI screenshot bleeding to the edge | SaaS, apps | Screenshot rises 26px + subtle 3D tilt on pointer |
| **Full-bleed scene** | text over media, scrim behind copy | Physical products, games | Shader/media layer + scrim, copy fades in place |
| **Typographic statement** | display type fills 80% of the viewport | Portfolios, studio sites | Per-character stagger, then a single underline draw |

Editorial left, concretely:

```html
<section class="hero" aria-labelledby="hero-title">
  <div class="hero__top">
    <p class="eyebrow" data-rv="fade"><i class="dot"></i>Chapter 01 — Kyoto</p>
    <h1 id="hero-title" class="display h-hero" data-rv="words">
      Where stillness reveals the unseen
    </h1>
    <p class="lede" data-rv="up">A five-chapter night walk through a mountain temple.</p>
    <div class="hero__actions" data-rv="up">
      <a class="btn btn--fill" href="#enter">Begin the walk</a>
      <a class="btn btn--text" href="#film">Watch the film</a>
    </div>
  </div>
  <div class="hero__spacer"></div>
  <div class="hero__foot" data-rv="up">…chapters, cue…</div>
</section>
```

```css
.hero {
  min-height: 100svh;
  padding: calc(84px + var(--s-5)) var(--pad) var(--s-6);
  display: flex; flex-direction: column;
}
.hero__top { max-width: min(560px, 46vw); }
.hero__spacer { flex: 1 1 auto; min-height: clamp(140px, 26vh, 300px); }
```

Hero rules:

- Exactly **one** primary action. A second action must be a text link, visually subordinate.
- The headline is the largest type on the page by at least 1.6×. If the nav logo is bigger,
  the hierarchy is inverted.
- Copy sits in the left 46% on desktop; the right side belongs to the artifact or the scene.
- Keep the fold honest: `100svh` so mobile browser chrome does not push the CTA out of view.
- No carousel. Ever.

---

## 3. Proof bar

**Job:** transfer trust in one line, immediately after the hero.

```html
<section class="proof" aria-label="Used by">
  <p class="proof__label">Shipping at</p>
  <ul class="proof__logos"><li>…</li></ul>
</section>
```

```css
.proof { padding: var(--s-7) var(--pad); border-block: 1px solid var(--line-soft); }
.proof__logos {
  display: flex; flex-wrap: wrap; gap: var(--s-6);
  filter: grayscale(1); opacity: .62;
  transition: opacity .3s var(--ease), filter .3s var(--ease);
}
.proof__logos:hover { opacity: 1; filter: none; }
```

- Logos in one row, all the same optical height (28px), `filter: grayscale(1)` so brand
  colours do not fight your palette.
- No animation here. Proof should look like a fact, not a feature.
- If you have fewer than four logos, use three metrics instead — do not fake a wall.

Metrics variant:

```html
<ul class="stats">
  <li><b class="num" data-count="12400">12,400</b><span>teams shipping</span></li>
</ul>
```

Always write the final number in HTML; the counter animates from 0 only after intersection.

---

## 4. Feature triad

**Job:** explain three capabilities without a wall of icons.

```css
.triad {
  display: grid; gap: var(--gap);
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}
```

Rules:

- The icon is not the feature. Lead with a short noun phrase, then one sentence of
  explanation, then an optional 1–2 word proof line ("42ms p95").
- One line-art icon set at 1.5px stroke, 24px, currentColor. No filled emoji, no mixed weights.
- Stagger children 85ms; lift the whole card 4px on hover, not just the icon.
- Uniform card heights via `align-content: start` on the inner column, not `min-height` guessing.

---

## 5. Bento

**Job:** show breadth where a list would be tedious. One cell must be obviously dominant.

```css
.bento {
  display: grid; gap: 12px;
  grid-template-columns: repeat(12, 1fr);
  grid-auto-rows: minmax(180px, auto);
}
.bento > :nth-child(1) { grid-column: span 7; grid-row: span 2; } /* the hero cell */
.bento > :nth-child(2) { grid-column: span 5; }
.bento > :nth-child(3) { grid-column: span 5; }
.bento > :nth-child(4) { grid-column: span 4; }
.bento > :nth-child(5) { grid-column: span 4; }
.bento > :nth-child(6) { grid-column: span 4; }
@media (max-width: 900px) {
  .bento > * { grid-column: span 12 !important; grid-row: auto !important; }
}
```

- The dominant cell gets the media or the shader. The rest get type and a hairline.
- Never make all cells equal — that is a feature triad wearing a costume.
- Hover: raise 2px, increase hairline contrast, and (only on the dominant cell) start its
  inner motion.

---

## 6. Pinned story

**Job:** make a mechanism understandable in sequence.

```html
<section class="story" aria-labelledby="story-title">
  <div class="story__pin">
    <div class="story__stage" aria-hidden="true"><!-- visuals swap here --></div>
    <div class="story__copy">
      <h2 id="story-title">Three passes, one frame</h2>
      <ol class="story__steps">
        <li data-step="0"><b>01</b><p>Capture the field.</p></li>
        <li data-step="1"><b>02</b><p>Resolve the surface.</p></li>
        <li data-step="2"><b>03</b><p>Grade the light.</p></li>
      </ol>
    </div>
  </div>
</section>
```

```css
.story { height: 320vh; }
.story__pin {
  position: sticky; top: 0; height: 100svh;
  display: grid; grid-template-columns: 1.1fr .9fr;
  align-items: center; gap: var(--gap); padding-inline: var(--pad);
}
.story__steps li { opacity: .28; transition: opacity .45s var(--ease); }
.story__steps li.is-active { opacity: 1; }
```

Rules:

- 3–4 steps. Height 2.5–4× viewport.
- Write the step change only when the index changes — not every frame.
- Reduced motion: unpin and stack every step with its visual.
- Mobile: unpin. A pinned 320vh section on a phone is a scroll trap.

---

## 7. Gallery

**Job:** let the work speak; get out of the way.

```css
.gallery {
  display: grid; gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
}
.gallery figure { overflow: hidden; border-radius: var(--r-lg); background: var(--ink-2); }
.gallery img {
  width: 100%; height: 100%; object-fit: cover; aspect-ratio: 4 / 3;
  transform: scale(1.01);
  transition: transform .9s var(--ease-out), filter .6s var(--ease);
}
.gallery figure:hover img { transform: scale(1.05); }
```

- One aspect ratio across the grid, or a deliberate 2:1 / 1:1 masonry with at least 5 items.
- `transform: scale` on the image inside `overflow: hidden`, never `width`.
- Captions outside the image, `--muted`, 13px, one line, `text-overflow: ellipsis`.
- Stagger 35ms, capped at 420ms.
- `content-visibility: auto` + `contain-intrinsic-size` if more than ~12 items.

---

## 8. Pricing

**Job:** remove the decision, not create a comparison puzzle.

```css
.plans { display: grid; gap: var(--gap); grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); align-items: start; }
.plan { padding: var(--s-5); border: 0.5px solid var(--line); border-radius: var(--r-lg); background: var(--surface); }
.plan--featured { border-color: var(--line-hard); box-shadow: var(--shadow-1); transform: translateY(-8px); }
```

- Three plans maximum. Four is a spreadsheet.
- One featured plan, raised 8px and given the only shadow on the page.
- Price in tabular numerals (`font-variant-numeric: tabular-nums`); period in muted 13px.
- Feature rows: check icon + 4–7 words. No paragraph inside a list item.
- The CTA label repeats the intent ("Start free"), never "Submit" or "Get started" on all three.

---

## 9. Testimonial

**Job:** one specific human, one specific claim.

```html
<figure class="quote">
  <blockquote><p>“We replaced four tools in a week.”</p></blockquote>
  <figcaption>
    <img src="…" alt="" width="40" height="40" loading="lazy" decoding="async">
    <span><b>Dana Whitfield</b><i>Head of Platform, Northwind</i></span>
  </figcaption>
</figure>
```

- One quote per section at display size (24–30px), not a carousel of five.
- Attribution with a real role and company; a name alone reads as invented.
- Avatar 40px, circular, `loading="lazy"`, `alt=""` (the name follows in text).
- If you need many quotes, use a masonry wall at 15–16px, not a slider.

---

## 10. FAQ and closing CTA

FAQ: native `<details>`, no JS required.

```css
.faq details { border-bottom: 1px solid var(--line-soft); padding: var(--s-4) 0; }
.faq summary {
  display: flex; justify-content: space-between; gap: var(--s-4);
  cursor: pointer; list-style: none; font-weight: 500;
}
.faq summary::-webkit-details-marker { display: none; }
.faq summary::after { content: '+'; transition: transform .32s var(--ease-io); }
.faq details[open] summary::after { transform: rotate(45deg); }
```

- Question as the `<summary>`, answer 2–3 sentences.
- 5–8 questions. Ten means the product is confusing.
- Accordion body animation: `grid-template-rows: 0fr → 1fr` (see `02-motion-system.md`).

Closing CTA:

```html
<section class="close">
  <h2 class="display h-sec" data-rv="up">Start with one page.</h2>
  <a class="btn btn--fill btn--lg" href="/start">Create an account</a>
  <p class="fineprint">No card required · 2 minutes</p>
</section>
```

- Full-width, cinematic padding (`--s-9` × 1.4), centered, one action.
- This is the one place a subtle glow is allowed — behind the CTA, not the heading.

---

## 11. Footer

Four columns maximum, then a bottom rule.

```css
.foot { padding: var(--s-8) var(--pad) var(--s-5); border-top: 1px solid var(--line-soft); }
.foot__grid { display: grid; gap: var(--s-6); grid-template-columns: 2fr repeat(3, 1fr); }
@media (max-width: 760px) { .foot__grid { grid-template-columns: 1fr 1fr; } }
```

- Column 1: brand mark, one-line description, and the only social icons.
- Columns 2–4: 4–6 links each, `--muted`, 14px, 32px row height.
- Bottom row: © year, locale, and one redundant legal link. 12px, `--muted`.
- No newsletter form in the footer unless the product has no other capture point.

---

## 12. Responsive rules that prevent 90% of mobile bugs

| Problem | Cause | Fix |
| --- | --- | --- |
| Horizontal scroll | A child wider than the grid, or a fixed-width element | `min-width: 0` on flex/grid children; `max-width: 100%` on media |
| Text overflowing a card | No `overflow-wrap` | `overflow-wrap: anywhere` on long strings/URLs |
| Fixed element off-centre | Initial containing block grew from horizontal overflow | Find and remove the overflow; do not patch with `left` |
| 100vh jump on mobile | `vh` includes collapsing browser chrome | `100svh` for layout, `100dvh` only for app shells |
| Tap target too small | Icon-only buttons | Minimum 44×44px hit area via padding |
| Text too small on iOS | Inputs under 16px trigger zoom | `font-size: 16px` on all form controls |
| Grid columns collapse | `auto-fit` with a min larger than the container | `minmax(min(320px, 100%), 1fr)` |

Breakpoints — use only what the layout actually needs:

```css
@media (max-width: 1023px) { /* tablet: stack the split layouts */ }
@media (max-width: 767px)  { /* phone: single column, unpin, stop parallax */ }
@media (hover: hover) and (pointer: fine) { /* pointer-only enhancements */ }
```

Never write `@media (max-width: 375px)` for a specific phone. Test at 360 and fix the
layout rule, not the device.
