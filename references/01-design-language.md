# 01 — Design language

The visual system: surfaces, hairlines, elevation, spacing rhythm, radii, and the five
palette archetypes. Read this before any layout or component work.

---

## 1. The four-layer surface model

Every high-quality dark interface is built from four layers, not one flat background.
Flattening them is the single most common reason a design looks cheap.

| Layer | Token | Purpose | Typical value (dark) | Typical value (light) |
| --- | --- | --- | --- | --- |
| Page | `--page` | The wall behind everything | `#050608` | `#ececeb` |
| Wall | `--wall` | App chrome, nav, sidebar | `#0a0b0d` | `#f3f3f2` |
| Surface | `--surface` | Cards, panels, popovers | `#101113` | `#f7f7f6` |
| Content | `--content-bg` | The reading plane | `#131416` | `#fbfbfa` |

Rules:

- Adjacent layers differ by 3–6% luminance, never more. Big jumps read as stripes.
- On dark palettes, the *content* plane is the lightest layer (it lifts toward the eye).
- Never place a `--surface` card directly on `--page` without a hairline; the two are too
  close to separate on their own.

```css
.panel {
  background: var(--surface);
  border: 0.5px solid var(--line);
  border-radius: var(--r-lg);
}
```

---

## 2. Hairlines, not borders

The signature of a refined UI is a 1px-or-less line at low alpha. Thick borders and
medium-grey dividers are the fastest way to look like a bootstrap template.

```css
:root {
  --line-soft: rgba(255,255,255,.07);  /* dividers inside a card */
  --line:      rgba(255,255,255,.13);  /* card edges */
  --line-hard: rgba(255,255,255,.26);  /* emphasis, active states */
}
```

On high-DPI screens, `0.5px` renders as a true hairline. Fall back gracefully:

```css
@media (-webkit-min-device-pixel-ratio: 1) {
  .panel { border-width: 1px; }
}
```

Light palettes invert the alpha colour: `rgba(0,0,0,.07)` / `.13` / `.26`.

**Inset hairlines** — for buttons and inputs, draw the line inside the shape so it never
shifts layout:

```css
.btn {
  box-shadow: inset 0 0 0 0.5px var(--line);
}
```

---

## 3. Elevation

One soft, layered shadow is enough. A single `0 4px 6px rgba(0,0,0,.1)` reads as a
sticker; a five-stop stack reads as air.

```css
:root {
  --shadow-1:
    0 2.8px 2.2px rgba(0,0,0,.034),
    0 6.7px 5.3px rgba(0,0,0,.048),
    0 12.5px 10px  rgba(0,0,0,.060),
    0 22.3px 17.9px rgba(0,0,0,.072),
    0 41.8px 33.4px rgba(0,0,0,.086),
    0 100px 80px rgba(0,0,0,.12);
}
```

Usage tiers:

| Tier | Token | Used for |
| --- | --- | --- |
| Flat | none + hairline | Default cards, inputs, list rows |
| Lifted | `--shadow-1` | Popovers, dropdowns, modals, sticky nav when scrolled |
| Glow | `0 0 <n>px var(--accent)` at 30–45% alpha | Only on the single focal element |

On dark palettes, prefer a *light top edge* over a shadow:

```css
.card-dark {
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
}
```

---

## 4. Spacing rhythm

A page feels expensive when its vertical density *changes deliberately*. Uniform gaps read
as a spreadsheet.

Base scale (4px grid, fluid at the top end):

```css
:root {
  --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px;
  --s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 64px;
  --s-9: clamp(88px, 15vh, 190px);   /* section padding — the big lever */
  --pad: clamp(20px, 3.4vw, 56px);   /* page gutter */
}
```

Three density modes, used in sequence down a page:

| Mode | Section padding | Gap | Feels like |
| --- | --- | --- | --- |
| Compressed | `--s-7` | `--s-4` | proof, logos, stats, dense features |
| Standard | `--s-8` | `--s-5` | body sections |
| Cinematic | `--s-9` | `--s-6` | hero, single-idea moments, closing CTA |

Alternate modes: `cinematic → compressed → standard → cinematic`. Never use the same mode
four sections in a row.

**Measure** (line length) is part of rhythm:

- Body copy: 62–72 characters (`max-width: 34em` at 16px, `~46em` at 20px).
- Lede: 40–55 characters.
- Captions and eyebrows: never wrap; 22ch max.

---

## 5. Radii

Four steps, no more. Mixing an 8px card with a 12px button and a 999px pill in one view is
the "assembled" smell.

```css
:root { --r-xs: 4px; --r-sm: 6px; --r-md: 9px; --r-lg: 14px; --r-pill: 999px; }
```

Assignment rule:

| Element | Radius |
| --- | --- |
| Badge, tag, chip | `--r-xs` |
| Input, small button | `--r-sm` |
| Button, control, code block | `--r-md` |
| Card, panel, media frame | `--r-lg` |
| Filter pill, segmented control | `--r-pill` |

Keep one radius per *scale* of element. A large card may use `--r-lg`; anything inside it
steps down one level.

---

## 6. Palette archetypes

Five directions that each read as authored. Pick one; do not invent a sixth unless the
brand demands it.

### A. Ink & Bone (dark, editorial)

```css
--ink:#05070a; --ink-2:#0a0e12; --bone:#dfe7e0; --bone-dim:#aab4ad;
--muted:#78837c; --accent:#e0231c; --accent-hot:#ff5a3c; --gold:#c9a24a;
```

Feels: Japanese architecture, print, quiet confidence. Type: Onest / Instrument Serif.
Signature: masked uppercase display + a single vermilion accent, grain overlay at 5%.

### B. Graphite & Paper (light, product)

```css
--page:#ececeb; --wall:#f3f3f2; --surface:#f7f7f6; --content:#fbfbfa;
--fg:#121211; --fg-muted:#5c5c5a; --accent:#1c1c1a; --tint:rgba(28,28,26,.035);
```

Feels: engineering tool, careful, honest. Type: JetBrains Mono / Geist.
Signature: mono eyebrows, 0.5px hairlines, one filled black CTA.
This is the safest palette for technical products — it ages well.

### C. Sepia & Ember (warm dark or warm light)

```css
--paper:#e4e1d7; --paper-2:#ece9e0; --ink:#131110; --muted:#57544a;
--accent:#c87046; --accent-2:#dbc39c;
```

Feels: bookshop, letterpress, craft. Type: Iowan Old Style / Newsreader.
Signature: serif display at large size with tight tracking (-0.06em).

### D. Night & Azure (deep blue, technical)

```css
--night:#060910; --night-2:#0b1220; --ice:#e6eefc; --ice-dim:#93a4c2;
--muted:#61708a; --accent:#3b82f6; --accent-hot:#7cc4ff;
```

Feels: infrastructure, precision, late-night focus. Type: Geist / Inter Tight.
Signature: thin cyan rule lines, dot-matrix or grid background, monospace numerals.

### E. Moss & Cream (organic light)

```css
--cream:#f2f0e6; --cream-2:#e7e5d8; --moss:#1f2a1d; --moss-dim:#4a5744;
--muted:#7d8878; --accent:#5c7a4a; --accent-hot:#a8c48f;
```

Feels: botanical, sustainable, calm. Type: Lexend / Newsreader.
Signature: generous line-height, organic image masks (`border-radius: 50% 40% 55% 45%`),
slow 12s ambient drift.

### Choosing

| Product type | Archetype |
| --- | --- |
| Dev tool, infra, API | B or D |
| Consumer app, lifestyle | E or C |
| Luxury, culture, portfolio | A or C |
| AI / data product | D with A's type discipline |
| Commerce, physical goods | C or E |

If the brand already has colours, keep its hue and rebuild the *ramp*: derive 3 surfaces,
3 text values, and a hairline from that hue. Never use the brand colour as the surface.

---

## 7. Grain, vignette, and scrims

Three overlays turn a flat page into a photographed one. All are `pointer-events: none`
and cheap:

```css
.grain {
  position: fixed; inset: -1px; z-index: 60; pointer-events: none;
  opacity: .055; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 180px 180px;
}
.vignette {
  position: fixed; inset: 0; z-index: 55; pointer-events: none;
  background: radial-gradient(125% 95% at 50% 42%, transparent 40%, rgba(2,4,6,.55) 100%);
}
.scrim {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(180deg, rgba(3,6,9,.72), rgba(3,6,9,.34) 46%, transparent);
}
```

Scrim rules:

- Directional, not flat. Text legibility comes from a gradient that is dense behind the
  type and zero where the image matters.
- Mask the scrim's own edges so it never lands as a seam:
  `mask-image: linear-gradient(transparent, #000 44%);`
- One scrim per text block. Stacking two flat overlays kills the image.

---

## 8. Component density checklist

Before calling a component done:

- [ ] Uses only tokens — no literal hex outside the token file.
- [ ] Hairline or shadow, not both, unless the shadow is inset.
- [ ] Hover state changes at least two properties (e.g. colour + translate 2px).
- [ ] Active state is `scale(.98)` or `translateY(1px)` — something physical.
- [ ] Focus ring visible on a keyboard tab.
- [ ] Disabled state is a real reduction in contrast, not `opacity: .5` on everything.
- [ ] Text truncation defined where a string could be long (`min-width: 0` + ellipsis).
- [ ] Works at 320px without overflow.
- [ ] Dark *and* light palette both pass contrast.

---

## 9. Reference tokens

Copy `assets/css/tokens.css` into the project. It contains all five archetypes, the
light/dark switch, the reset, and the base type scale already wired to
`data-scheme` / `data-palette` attributes on `<html>`.
