# 08 — Accessibility

Motion-heavy sites fail accessibility in predictable ways. This is the short list that
prevents all of them.

---

## 1. Reduced motion is a first-class state

CSS safety net (bottom of `motion.css`):

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
  [data-rv], .js [data-rv] { opacity: 1 !important; transform: none !important; }
  .word, .mask-line > span { opacity: 1 !important; transform: none !important; }
  .story { height: auto !important; }
  .story__pin { position: static !important; height: auto !important; }
  .parallax, .marquee { transform: none !important; animation: none !important; }
}
```

JS side — the part CSS cannot do:

```js
const mq = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = mq.matches;
mq.addEventListener('change', (e) => {
  reduced = e.matches;
  if (reduced) shader.renderOnce();   // freeze to a still frame
  else shader.start();
});
```

What must stop, not merely speed up:

| Feature | Reduced-motion behaviour |
| --- | --- |
| Word/line masks | Text visible immediately, no transform |
| Scroll parallax | Disabled |
| Marquee / auto-scrolling rail | Stopped, static |
| Shader / canvas ambient | One still frame, loop cancelled |
| Pinned narrative | Unpinned, all steps stacked and visible |
| Cursor glow / tilt | Disabled |
| Video autoplay | Poster frame only, controls visible |
| Page transitions | Instant |

Threshold guidance: motion that translates more than ~10% of the viewport, parallax, zoom,
rotation, and anything that loops indefinitely are the categories that trigger vestibular
symptoms. Keep a ≤ 200ms opacity change so state changes stay legible.

---

## 2. Semantics

```html
<a class="skip" href="#main">Skip to content</a>
<header>…</header>
<main id="main">
  <section aria-labelledby="s1-title">
    <h2 id="s1-title">How it works</h2>
  </section>
</main>
<footer>…</footer>
```

- One `<main>`, one `<h1>`, no skipped heading levels.
- `<section>` needs an accessible name to be exposed as a landmark; otherwise use `<div>`.
- Every icon-only control needs `aria-label`. Text inside a `<button>` is its name — do not
  also set `aria-label` to a different string.
- Decorative SVG: `aria-hidden="true" focusable="false"`.
- Decorative canvas: `aria-hidden="true"` and `pointer-events: none`.
- Links that look like buttons keep `role="link"` semantics; do not fake navigation with `<button>`.
- `lang` on `<html>`; mark inline foreign-language runs.

---

## 3. Keyboard

Everything operable by pointer must be operable by keyboard, in a logical order.

| Component | Requirement |
| --- | --- |
| Accordion | `<details>/<summary>` — free keyboard support |
| Tabs | `role="tablist"`, arrow keys move, `aria-selected`, roving `tabindex` |
| Dialog / sheet | Focus trapped, `Esc` closes, focus returns to the opener, `aria-modal="true"` |
| Menu | `aria-expanded`, arrow keys, `Esc`, click-outside |
| Carousel | Prev/next buttons, `aria-live="polite"` on the slide region, no autoplay |
| Rail / horizontal scroller | `tabindex="0"` + `aria-label` so arrow keys reach it |
| Custom checkbox/toggle | Real `<input>` under the visual, or full ARIA + Space/Enter |

Focus visibility:

```css
:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--accent) 68%, transparent);
  outline-offset: 2px;
  border-radius: inherit;
}
:focus:not(:focus-visible) { outline: none; }
```

Never `outline: none` without a visible replacement. On dark surfaces, an accent ring at
68% may fail 3:1 — verify against the surface behind it.

---

## 4. Split text and animations vs screen readers

Word-splitting breaks the reading order unless handled:

```js
heading.setAttribute('aria-label', phrase);   // the real string
span.setAttribute('aria-hidden', 'true');     // the visual spans
```

Wrap animated containers that change content in `aria-live="polite"` only when the change is
meaningful (e.g. filter result count). Never put `aria-live` on a whole section — every
animation frame would be announced.

Skeletons: `aria-busy="true"` on the region, and keep the final text in the DOM where
possible.

---

## 5. Forms

```html
<label for="email">Work email</label>
<input id="email" name="email" type="email" autocomplete="email"
       required aria-describedby="email-hint email-error">
<p id="email-hint" class="hint">We reply within one business day.</p>
<p id="email-error" class="error" role="alert"></p>
```

- Visible `<label>`, always. Placeholders are not labels.
- `autocomplete` on every identity/address field.
- Errors: text + `aria-describedby` + `role="alert"`, not colour alone.
- Never block paste on password fields.
- Inputs are ≥ 16px on iOS to prevent zoom.
- Touch targets ≥ 44×44px.

---

## 6. Contrast and colour

| Element | Ratio |
| --- | --- |
| Body text | 4.5:1 |
| Large text (≥ 24px, or ≥ 19px bold) | 3:1 |
| Icons and UI boundaries | 3:1 |
| Focus ring | 3:1 against the adjacent surface |
| Text over imagery | Verify against the *lightest* region behind it |

Never signal state with colour alone: pair with an icon, weight, or label.

Dark themes commonly fail on `--fg-muted` (grey on near-black). Minimum for 14px muted text
on `#05070a` is roughly `#8a9a94` — check, do not assume.

---

## 7. Motion safety

| Rule | Detail |
| --- | --- |
| No flashing above 3 Hz | Seizure risk |
| No infinite full-screen motion without a pause | WCAG 2.2.2 |
| No autoplay audio | Ever |
| Autoplay video must be muted + `playsinline` + have controls | Battery and consent |
| Scroll must never be hijacked | Native scroll only |
| No motion that suggests the page is loading when it is not | Progress bars must reflect real progress |

---

## 8. Testing

1. Keyboard only: tab from the top; every interactive element reachable and visible.
2. Screen reader pass (VoiceOver / NVDA): headings announce in order; split headings read as
   full sentences; canvas is silent; form errors are announced.
3. `prefers-reduced-motion: reduce` in DevTools Rendering panel: no movement, nothing hidden.
4. 200% zoom: no horizontal scroll, no clipped text.
5. Windows High Contrast / forced-colors: borders and focus remain visible
   (`forced-color-adjust: auto`, avoid background-image-only affordances).
6. JS disabled: all content present.

---

## 9. Checklist

- [ ] Reduced-motion block in CSS **and** JS media query with a `change` listener.
- [ ] Shaders render one still frame under reduced motion.
- [ ] Focus ring visible on every interactive element.
- [ ] Skip link first in the DOM.
- [ ] One `h1`, ordered headings, named landmarks.
- [ ] Icons have labels; decorative elements are `aria-hidden`.
- [ ] Split headings keep an `aria-label`.
- [ ] Dialogs trap focus and restore it on close.
- [ ] Contrast verified in both colour schemes.
- [ ] Forms have labels, autocomplete, and announced errors.
- [ ] No scroll hijacking, no autoplay audio, no > 3Hz flashing.
