# 10 — QA checklist

The pre-flight pass. Run it every time, in this order. Anything unchecked is a shipped bug.

---

## 1. Automatic

```bash
node <skill-dir>/scripts/audit.mjs ./dist   # static rule audit, bundled with this skill
npm run build                               # or the project's own build
npx serve ./dist                            # serve the production build, not the dev server
```

The audit fails on the hard rules: `transition: all`, animating layout properties,
unbounded `will-change`, missing reduced-motion block, canvas without `aria-hidden`,
permanent observers, and more. Fix the cause, never add an ignore.

---

## 2. Content, with CSS disabled

Disable stylesheets in DevTools and read the page top to bottom.

- [ ] The story is understandable.
- [ ] Heading order is `h1 → h2 → h3`, exactly one `h1`.
- [ ] Every link and button has meaningful text (no "click here", no bare "→").
- [ ] No text is baked into images or canvas without a DOM equivalent.
- [ ] Nav and footer are the same on every page.

---

## 3. Layout at width

Check 320, 360, 390, 414, 768, 1024, 1280, 1440, 1920, 2560.

- [ ] No horizontal scrollbar at any width (`document.documentElement.scrollWidth <= innerWidth`).
- [ ] No text clipped by a fixed-height container.
- [ ] Hero CTA visible without scrolling at 360×640.
- [ ] Grids collapse without orphans (a lone card on its own row).
- [ ] Images never upscale past their intrinsic size.
- [ ] Touch targets ≥ 44px.
- [ ] Sticky nav does not cover anchor targets (`scroll-margin-top` on headings).

```js
// console one-liner for overflow hunting
[...document.querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > innerWidth + 1)
  .forEach(el => console.warn(el, el.getBoundingClientRect()));
```

---

## 4. Motion

- [ ] Every entrance fires once, in reading order, with the intended stagger.
- [ ] No element animates twice (scroll up and back down).
- [ ] Nothing is still invisible 2s after it entered the viewport.
- [ ] Exits are faster than entrances.
- [ ] Hover states work and are not required to understand the page.
- [ ] No animation longer than 1200ms except a deliberate curtain.
- [ ] Total stagger delay for any group ≤ 420ms.
- [ ] Pinned section releases cleanly; no gap or jump at the end.

---

## 5. Reduced motion

DevTools → Rendering → *Emulate CSS media feature `prefers-reduced-motion`*.

- [ ] All content visible immediately.
- [ ] No transforms on reveal elements.
- [ ] Shader shows a still frame (not black, not animated).
- [ ] Parallax, marquee, cursor effects disabled.
- [ ] Pinned section is unpinned and every step is readable.
- [ ] Page still looks designed, not broken.

---

## 6. Keyboard and focus

- [ ] First Tab shows the skip link.
- [ ] Tab order follows visual order.
- [ ] Focus ring visible against every surface it lands on.
- [ ] `Esc` closes modal / sheet / menu.
- [ ] Focus returns to the opener after close.
- [ ] Accordion toggles with Enter/Space and announces state.
- [ ] Horizontal scrollers reachable by keyboard.

---

## 7. Performance

- [ ] Network throttled to Slow 4G: hero text readable before the shader appears.
- [ ] 4× CPU throttle: scrolling holds ~60fps.
- [ ] Performance recording shows zero "Layout" entries during scroll.
- [ ] No long task > 50ms during scroll.
- [ ] Tab away for 30s → CPU near zero.
- [ ] Lighthouse mobile: LCP ≤ 2.0s, CLS ≤ 0.02, TBT ≤ 200ms.
- [ ] JS and CSS within budget (`07-performance-budget.md` §1).
- [ ] All below-fold images `loading="lazy"`; hero is not.
- [ ] Every image has `width` and `height`.

---

## 8. Resilience

- [ ] JavaScript disabled: all content present, nothing hidden by a reveal.
- [ ] WebGL blocked (`chrome://flags` or `about:config`): the CSS fallback looks intentional.
- [ ] Web font blocked: fallback stack holds layout (no CLS).
- [ ] Slow network: no layout jumping as images arrive.
- [ ] 200% browser zoom: no clipped text, no horizontal scroll.
- [ ] Forced colours / high contrast: borders and focus remain visible.

---

## 9. Console

- [ ] Zero errors.
- [ ] Zero 404s (fonts, images, modules).
- [ ] No WebGL warnings about precision, attributes, or programs.
- [ ] No React key / hydration warnings.
- [ ] No "too many WebGL contexts".
- [ ] No unused preconnect warnings.

---

## 10. Production build only

Run these against `dist`, never the dev server.

- [ ] No source maps in the public output.
- [ ] Asset URLs resolve from a deep link (e.g. `/pricing` refresh works).
- [ ] Hashed filenames for JS/CSS/images.
- [ ] Compression enabled (brotli preferred).
- [ ] 404 route renders a designed page, not a stack trace.
- [ ] `<title>`, `<meta name="description">`, and Open Graph tags present and unique per page.
- [ ] Favicon and theme-colour meta present.
- [ ] `robots.txt` and `sitemap.xml` if public.

---

## 11. Sign-off record

Paste this into the PR description when done:

```markdown
## Visual
- Signature moment: <what it is>
- Motion level: <0-3>
- Palette: <archetype> | Type: <pairing>

## Numbers
- LCP / CLS / TBT (mobile): x.x s / x.xx / xxx ms
- JS / CSS (gzip): xx KB / xx KB
- WebGL contexts: n

## Degrades
- Reduced motion: <what stops>
- No JS: <what is still visible>
- No WebGL: <fallback>

## Known gaps
- <anything intentionally deferred>
```

If the "known gaps" list is longer than the delivered list, the page is not ready.
