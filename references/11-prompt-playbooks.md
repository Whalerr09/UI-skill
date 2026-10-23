# 11 — Prompt playbooks

Repeatable sequences for the five requests that cover most work. Each playbook is a set of
steps *and* the prompts to use at each step — for an agent, and for a human handing work to
one.

---

## How to write a brief an agent can act on

Vague prompts produce generic sites. The four things that change the output:

| Vague | Actionable |
| --- | --- |
| "modern, clean" | "editorial dark, ink #05070a + bone #dfe7e0, one vermilion accent, Instrument Serif display over Geist body" |
| "smooth animations" | "motion level 2: masked word reveals, 55ms card stagger, hero exit with blur, one fBm shader behind the hero" |
| "make it pop" | "one signature moment: the product screenshot tilts 6° toward the pointer and the CTA glows on idle" |
| "responsive" | "must be correct at 360, 768, 1440; unpin the story below 1024; disable parallax below 768" |

Template:

```
Build <page type> for <product>.
Audience: <who>. Promise: "<one sentence>".
Palette: <archetype + two hexes>. Type: <pairing>.
Motion level: <0-3>. Signature: <one thing>.
Sections: <ordered list>.
Stack: <framework>. Must degrade: reduced motion, no JS, no WebGL.
Do not: <specific bans — carousel, stock illustrations, purple gradients>.
```

---

## Playbook A — Full landing page from a one-line brief

**A1. Lock decisions before code.** Ask for or write `design-brief.md` (SKILL.md §2). Do not
proceed until palette, type pairing, motion level, and signature are named.

**A2. Skeleton.** Semantic HTML for every section, no CSS. Verify reading order and heading
levels. Write the one-line job of each section as an HTML comment.

**A3. Tokens.** Copy `assets/css/tokens.css`, set the six palette values for the chosen
archetype, set `data-scheme` and `data-palette`. No literal colours may appear afterwards.

**A4. Layout.** `layout.css`: page shell, section rhythm (`--s-9`), grids, nav, footer. Test
at 360 and 1440 before adding a single transition. If the layout is weak here, stop and fix it.

**A5. Type.** Apply the scale, tracking, measure. Headings balanced. Verify the fold at
360×640 shows the promise and one CTA.

**A6. Feedback motion.** Hover, press, focus. 120–180ms. Verify with keyboard.

**A7. Entrance motion.** Wire `assets/js/reveal.js`: `data-rv` on section headers, grid
children, media. Add `html.js` gate. Confirm no-JS visibility.

**A8. Signature layer.** Only now add the one chosen moment (masked headline, shader, pin,
tilt). Wire lifecycle: DPR clamp, IO pause, reduced motion, teardown.

**A9. Hero exit.** Map scroll 0→1 over the hero and stagger the exit. Hand everything back at
`p = 0`. Do not animate a parent and its children.

**A10. Audit.** `node scripts/audit.mjs ./dist`. Fix every finding.

**A11. Manual QA.** `references/10-qa-checklist.md`, all sections.

**A12. README + sign-off.** Three bullets: the motion, the type pairing, the performance
decision. Plus the degradation notes.

Prompt for A1–A3:

```
Before writing code, produce design-brief.md with: promise, audience, three adjectives,
palette archetype and its 6 hex values, type pairing with fallback stacks, motion level
0-3 with a one-line justification, and the single signature moment. Then create
styles/tokens.css containing only tokens - no selectors except the palette blocks on
:root and html[data-scheme]. Do not create any other file yet.
```

Prompt for A7:

```
Add scroll reveals using IntersectionObserver only - one observer for the page, unobserved
after firing, rootMargin "0px 0px -10% 0px", threshold .04. Content must be visible with JS
disabled, so gate the hidden state behind html.js added in an inline head script. Stagger
siblings 85ms via data-rvd, capped at 420ms. Respect prefers-reduced-motion by showing
everything immediately. Do not set inline opacity on any element at rest.
```

Prompt for A9:

```
Implement the hero exit: map scroll progress 0..1 across the hero height. Each element gets
{at, span} and eases opacity and translateY(-18px); large media also blurs up to 10px.
Write styles only when progress > 0 and reset all inline styles at progress 0. Do not animate
a parent together with its children. Run it inside the existing single scroll rAF, not a new
listener.
```

---

## Playbook B — "Make it feel premium" retrofit

Use when the site already exists and looks assembled.

**B1. Inventory.** Screenshot every section. List every distinct radius, shadow, grey, easing
and duration used. The list is almost always 3–5× longer than it should be.

**B2. Collapse.** Reduce to: 4 radii, 1 shadow (+1 glow), 6 render-safe greys, 4 easings,
6 durations. Replace mechanically. This step alone fixes most of the "cheap" feeling.

**B3. Hairlines.** Replace `1px solid #333`-style borders with `0.5px solid var(--line)`.
Replace heavy dividers with `--line-soft`.

**B4. Type.** Apply the fluid scale. Add negative tracking to every heading. Set `text-wrap:
balance`. Fix measure to 60–72ch. Fix heading margins to 2:1 top:bottom.

**B5. Rhythm.** Set section padding to the three density modes and alternate them. Most
"cheap" pages have uniform 80px padding everywhere.

**B6. Hierarchy.** Ensure exactly one primary CTA per viewport and one accent-coloured
element per viewport. Demote everything else to text links.

**B7. Motion pass.** Replace `transition: all` with explicit properties. Standardise to
`--ease-out` for entrances. Add stagger where a group appears at once. Add masked reveal to
the `h1` only.

**B8. One signature.** Add a single memorable moment. Not three.

**B9. Verify.** Audit + QA. Re-screenshot and compare.

Prompt:

```
Audit the visual system, do not redesign it. Produce a table of every distinct
border-radius, box-shadow, grey hex, easing curve, and duration in the CSS with a count of
occurrences. Then propose a collapsed scale of 4 radii / 1 shadow / 6 greys / 4 easings /
6 durations mapping each existing value to its replacement. Do not change layout or copy.
```

---

## Playbook C — Add a shader hero

**C1. Justify it.** Name why CSS cannot do it (per-pixel noise, volumetric light, liquid
surface). If a gradient + grain reads as well, stop.

**C2. Choose the host.** Raw WebGL fullscreen (rung 4) unless real geometry is required.
Copy `assets/js/gl/ShaderCanvas.js`.

**C3. Fallback first.** Write `.gl-hero__fallback` (two radial gradients + base colour) and
verify it looks complete with the canvas hidden.

**C4. Shader.** Start from `assets/js/gl/shaders/aurora.js`. Normalise `uv` by
`min(uRes.x, uRes.y)`. Feed colours from tokens as uniforms. 3–5 fBm octaves. Add vignette,
grain, dither.

**C5. Compositing.** Canvas `z-index: 0`, scrim `z-index: 1`, content `z-index: 10`,
vignette fixed at 55, grain fixed at 60. Canvas `aria-hidden` + `pointer-events: none`.

**C6. Lifecycle.** DPR clamp 2, `ResizeObserver`, `IntersectionObserver`, `visibilitychange`,
reduced motion → one frame, context-loss recovery, `destroy()`.

**C7. Budget.** Confirm: 1 context, ≤ 12ms frame, ≤ 30% GPU on a mid-tier phone, hero text
readable before the shader bundle loads.

Prompt:

```
Add a fullscreen WebGL shader to the hero, behind the existing content, using raw WebGL
(no Three.js). Requirements:
- fullscreen triangle, uv normalised by min(uRes.x, uRes.y)
- fBm noise, 4 octaves, colours from the --accent and --ink tokens read via getComputedStyle
- vignette + dither to avoid banding
- backing store = clientWidth * min(devicePixelRatio, 2)
- pause when offscreen, when the tab is hidden, and under prefers-reduced-motion (render one frame)
- recover from webglcontextlost
- expose a destroy() that deletes program, shaders, buffer and removes all listeners
- a CSS gradient fallback that is visible when the context is unavailable
Do not initialise at module scope; mount it from an IntersectionObserver.
```

---

## Playbook D — Performance rescue

Use when the page scrolls badly or scores poorly.

**D1. Measure.** Record a 5s scroll in Performance. Note long tasks, Layout entries, and the
heaviest paint.

**D2. Fix the top three only.** In practice these are: a non-compositor animation, a
per-frame layout read, and an eagerly loaded shader. Fixing three items usually doubles the
score.

**D3. Images.** Add `width`/`height`, `srcset`/`sizes`, AVIF, lazy below the fold,
`fetchpriority="high"` on the hero.

**D4. Fonts.** Two families max, subset, `display=swap`, preload the one above-fold face,
add a metric-override fallback.

**D5. JS.** Remove an animation library if it only does reveals. Dynamic-import any GL module
behind an observer.

**D6. CSS.** Add `content-visibility: auto` to long lists, `contain` to cards, delete
permanent `will-change`.

**D7. Re-measure.** Same recording, same throttle. Compare.

Prompt:

```
Profile-first: do not optimise anything before measuring. From the attached Performance
recording, list every long task over 50ms with its likely source, and every frame containing
Recalculate Style or Layout during scroll. Then fix only the three highest-cost items, one
commit each, and state the expected delta before applying it.
```

---

## Playbook E — Multi-page brand site

**E1.** Shared tokens, layout, motion. Three CSS files, no per-page overrides except layout
variants.

**E2.** One nav and one footer component; only the active link changes.

**E3.** Each page gets a different *section order*, not a different visual language. Same
palette, same type, same easing.

**E4.** Page transitions: 300–450ms crossfade. No full-screen wipes on internal navigation.

**E5.** Prefetch the next likely page on hover only.

**E6.** Shared partials for: logo lockup, section header with eyebrow, CTA block, FAQ.

---

## Prompt fix-ups

Common instructions and what to say instead:

| Instead of | Say |
| --- | --- |
| "make it modern" | "0.5px hairlines, 4-step radius scale, one accent per viewport, generous section padding" |
| "add animations" | "motion level 1: masked h1, 85ms stagger on cards, 180ms hover feedback, nothing else" |
| "make it faster" | "LCP ≤ 2.0s: preload hero image with fetchpriority=high, lazy everything below the fold, defer the shader" |
| "use a nice font" | "<pairing> with these fallback stacks, two families only, subset + display=swap" |
| "add a 3D background" | "one fBm shader behind the hero, CSS gradient fallback, pauses offscreen and under reduced motion" |
| "make the hero better" | "hero: one promise, one primary CTA, artifact in the right 54%, masked word reveal, scroll exit with blur at p>0.7" |

---

## Self-review prompt (run before declaring done)

```
Review the build against these six questions and answer each in one sentence:
1. What is the single signature moment, and does anything compete with it?
2. Which properties are animated per frame, and are they all compositor-only?
3. What happens with prefers-reduced-motion, with JS disabled, and with WebGL unavailable?
4. Where is the layout weakest, and is it at 360px or 1440px?
5. Name three numbers: LCP, CLS, and total JS gzip.
6. Which section could be deleted without losing the argument?
```
