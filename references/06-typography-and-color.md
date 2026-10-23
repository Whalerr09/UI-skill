# 06 — Typography and colour

Type carries more perceived quality than any animation. Get the scale, tracking, and
measure right and a static page already looks commissioned.

---

## 1. The fluid scale

One scale, six steps, each with its own tracking. Do not invent sizes per section.

```css
:root {
  /* min at 360px viewport, max at 1440px */
  --t-display: clamp(44px, 7.2vw, 104px);
  --t-h1:      clamp(34px, 4.6vw, 64px);
  --t-h2:      clamp(28px, 3.4vw, 46px);
  --t-h3:      clamp(20px, 1.8vw, 26px);
  --t-body-lg: clamp(16px, 1.05vw, 19px);
  --t-body:    16px;
  --t-sm:      14px;
  --t-xs:      12px;
  --t-eyebrow: 10px;
}
```

Why `clamp(min, vw, max)` and not breakpoints: the type grows continuously with the
viewport, so there is never a jump at 1024px where the headline suddenly halves.

Tune the middle term: `vw` value ≈ `(max − min) / (1440 − 360) × 100`, then add a little.
Too low and the text only hits its max on a 4K screen; too high and it overshoots on tablets.

---

## 2. Tracking is size-dependent

Large type needs negative tracking; small type needs positive tracking. Ignoring this is
the fastest way to look amateur.

| Size | `letter-spacing` | `line-height` |
| --- | --- | --- |
| Display (≥ 64px) | `-0.03em` to `-0.045em` | `0.95` – `1.02` |
| H1 (34–64px) | `-0.02em` to `-0.03em` | `1.04` – `1.1` |
| H2 (28–46px) | `-0.015em` | `1.1` – `1.15` |
| H3 (20–26px) | `-0.01em` | `1.25` |
| Body | `0` to `0.005em` | `1.6` – `1.72` |
| Small (14px) | `0.005em` | `1.5` |
| Eyebrow / caps | `0.18em` – `0.24em` | `1` |
| Button | `0.01em` | `1` |

Uppercase display type needs *more* negative tracking than sentence case at the same size,
because caps are optically wider. `-0.012em` on a 46px uppercase line is roughly equivalent
to `-0.02em` on a mixed-case line.

---

## 3. Measure and rhythm

```css
.prose  { max-width: 66ch; }
.lede   { max-width: 44ch; font-size: var(--t-body-lg); line-height: 1.68; }
.caption{ max-width: 34ch; font-size: var(--t-sm); color: var(--muted); }
```

- 60–72 characters per line for body. Below 45 the eye jumps; above 80 it loses the return sweep.
- Increase `line-height` as measure narrows: 1.6 at 66ch, 1.72 at 44ch.
- Paragraph spacing: `margin-block: 0 var(--s-4)`; never `text-indent` on the web.
- Headings get `margin-top: 0` and a top margin larger than their bottom margin (2:1) so they
  bind to the text they introduce.

Balance and orphan control:

```css
h1, h2, h3, .display { text-wrap: balance; }
p, li, blockquote    { text-wrap: pretty; }
```

`balance` on headings is transformative — it removes the single dangling word that makes a
headline look unresolved. Do not apply it to long paragraphs (it is expensive above ~6 lines).

---

## 4. Pairings

Five combinations that hold up. Each is a *system*: a display face, a text face, and a mono
for labels and numbers when relevant.

| # | Display | Text | Mono | Feels |
| --- | --- | --- | --- | --- |
| 1 | Instrument Serif | Geist | JetBrains Mono | Editorial, cultural, confident |
| 2 | Onest (400) | Onest (300) | Fragment Mono | Nordic, quiet, architectural |
| 3 | Iowan Old Style / Newsreader | Inter | — | Books, craft, long-form |
| 4 | Geist (500) | Geist (400) | Geist Mono | Technical, precise, neutral |
| 5 | Lexend (300) | Lexend (300) | — | Calm, accessible, organic |

Loading (Google Fonts, `display=swap`, only the weights used):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Geist:wght@300..600&display=swap">
```

Always declare a full fallback stack so the first paint is not invisible:

```css
--font-display: "Instrument Serif", Georgia, "Times New Roman", serif;
--font-sans: "Geist", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
```

Self-host when the page must be fast or offline: `woff2` only, subset to `latin` plus the
punctuation you actually use, `font-display: swap`, and `preload` the one face used above
the fold. Two faces maximum per page; a third face costs more than it communicates.

Metric-safe fallbacks (kills the layout shift when the webfont swaps in):

```css
@font-face {
  font-family: "Geist Fallback";
  src: local("Arial");
  ascent-override: 92%;
  descent-override: 24%;
  line-gap-override: 0%;
}
```

---

## 5. Type details that separate good from great

```css
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
.num, .price, table td { font-variant-numeric: tabular-nums; }
.eyebrow {
  font-size: var(--t-eyebrow);
  font-weight: 500;
  letter-spacing: .22em;
  text-transform: uppercase;
  color: var(--fg-muted);
}
```

| Detail | Rule |
| --- | --- |
| Optical alignment | Pull a displayed quote mark or a bullet left by `margin-inline-start: -0.42em` so the glyph edge aligns with the text block |
| Hanging punctuation | `hanging-punctuation: first last;` where supported |
| Small caps | Use for abbreviations (API, JSON) in prose, not for headings |
| Hyphenation | `hyphens: auto` only in narrow columns (`< 34ch`); otherwise off |
| Underlines | `text-decoration-thickness: .06em; text-underline-offset: .18em;` |
| Selection | Style it: `::selection { background: color-mix(in oklab, var(--accent) 35%, transparent); }` |
| Focus in text | Never remove the outline; restyle it |
| Links in prose | Underline, not colour alone (colour alone fails WCAG 1.4.1) |
| Truncation | `min-width: 0` on the flex child, then `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` |

Numbers in a display context (stats, prices) should be *larger and tighter* than the label,
with the unit set smaller:

```html
<p class="stat"><b class="num">12,400</b><span class="unit">teams</span></p>
```

```css
.stat b { font-size: clamp(32px, 3.2vw, 44px); letter-spacing: -0.03em; }
.stat .unit { font-size: var(--t-sm); color: var(--fg-muted); margin-left: .35em; }
```

---

## 6. Colour: derive, do not pick

Build the palette from one hue and a neutral ramp. Never select eight unrelated hexes.

### Step 1 — choose the accent hue

One hue. Its job is to mark the single most important thing in each viewport. If two things
are accent-coloured, neither is.

### Step 2 — derive the ramp with `color-mix`

```css
:root {
  --accent: #e0231c;
  --accent-hot:  color-mix(in oklab, var(--accent) 78%, white);
  --accent-deep: color-mix(in oklab, var(--accent) 70%, black);
  --accent-soft: color-mix(in oklab, var(--accent) 14%, transparent);
}
```

`oklab` keeps perceptual lightness stable across hues, so the same formula works whether the
accent is red, azure, or moss. `rgb` mixing produces muddy midpoints; `oklab` does not.

### Step 3 — neutral ramp

```css
:root {
  --ink:      #05070a;
  --ink-2:    #0a0e12;
  --ink-3:    #12161b;
  --line:     rgba(223,231,224,.13);
  --fg:       #dfe7e0;
  --fg-muted: #aab4ad;
  --fg-faint: #78837c;
}
```

Six values. If a component needs a seventh grey, it is a token bug, not a design need.

### Step 4 — verify contrast

| Text | Minimum ratio |
| --- | --- |
| Body (< 24px) | 4.5:1 |
| Large (≥ 24px, or ≥ 19px bold) | 3:1 |
| UI borders and icons | 3:1 against adjacent colour |
| Disabled | exempt, but must still be *readable* — use 40–50% alpha, not 20% |

Test both palettes. A palette that only works in dark mode is half-designed.

---

## 7. Colour techniques worth knowing

```css
/* tint a surface toward the accent without changing its role */
.card--tinted { background: color-mix(in oklab, var(--surface) 92%, var(--accent)); }

/* accent glow behind a focal element — the only place glow is allowed */
.cta::after {
  content: ''; position: absolute; inset: -60% -40%;
  background: radial-gradient(50% 50% at 50% 50%, var(--accent-soft), transparent 70%);
  filter: blur(40px); z-index: -1; pointer-events: none;
}

/* gradient text, used once per page at most */
.grad {
  background: linear-gradient(100deg, var(--fg) 30%, var(--accent-hot));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

/* readable text over any image, without a flat overlay */
.over-img {
  background: linear-gradient(180deg, rgba(3,6,9,.72), rgba(3,6,9,.34) 46%, transparent);
  -webkit-background-clip: text; background-clip: text; color: var(--fg);
}
```

Gradient text caveats: keep the gradient direction near-horizontal (a vertical gradient
makes parts of a line unreadable), never apply to paragraphs, and always provide a solid
colour fallback via `@supports not ((-webkit-background-clip: text) or (background-clip: text))`.

---

## 8. Dark and light, done once

Drive both from attributes on `<html>`, not from a class per component:

```css
html[data-scheme="dark"] { color-scheme: dark; --page:#050608; --fg:#f7f8f8; … }
html[data-scheme="light"] { color-scheme: light; --page:#ececeb; --fg:#121211; … }
@media (prefers-color-scheme: light) { html:not([data-scheme]) { … } }
```

Rules for the inversion:

- Do not simply swap black and white. Dark surfaces need *less* saturation in accents; light
  surfaces need *more*.
- Shadows disappear on dark. Replace them with light top-edge insets.
- Images and screenshots often need `filter: brightness(.92) contrast(1.04)` on dark to avoid
  glare.
- Borders flip from `rgba(255,255,255,.13)` to `rgba(0,0,0,.09)` — the dark version is always
  slightly stronger because dark surfaces have less natural separation.

---

## 9. Checklist

- [ ] One `h1`, scale locked, no ad-hoc `font-size` outside the tokens.
- [ ] Tracking negative on display, positive on eyebrows.
- [ ] Body measure 60–72ch; lede ≤ 55ch.
- [ ] `text-wrap: balance` on headings.
- [ ] Two font families maximum; each with a full fallback stack.
- [ ] Fonts `display=swap` and preconnected; hero font optionally preloaded.
- [ ] Tabular numerals wherever figures align.
- [ ] Contrast verified in both schemes.
- [ ] Accent used on one element per viewport.
- [ ] Selection and focus styles present.
