# 09 — Stack adapters

The same system, expressed in each ecosystem. Pick the section for the target project; the
values, curves, and rules never change.

---

## 1. Vanilla HTML/CSS/JS

The default. No build step, no dependencies, no hydration cost.

```
index.html
styles/tokens.css
styles/layout.css
styles/motion.css
scripts/main.js        (type="module")
scripts/reveal.js
scripts/scroll.js
scripts/gl/ShaderCanvas.js
```

```html
<script type="module" src="/scripts/main.js"></script>
```

```js
// main.js
import { initReveal } from './reveal.js';
import { initScroll } from './scroll.js';

initReveal();
initScroll();
```

If the page needs a bundler, Vite is the lowest-friction option and matches what this
repository uses. `npm create vite@latest`. Nothing here requires a framework.

---

## 2. React 19

The lifecycle rules matter more than the syntax. Effects must be idempotent, because React 19
StrictMode double-invokes them in development.

```tsx
import { useEffect, useRef } from 'react';

export function Reveal({ children, as: Tag = 'div', delay = 0, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      io.unobserve(el);
      el.style.transitionDelay = `${delay}ms`;
      el.classList.add('rv-in');
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.04 });

    if (el.getBoundingClientRect().top < innerHeight) el.classList.add('rv-in');
    else io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return <Tag ref={ref} data-rv="up" {...rest}>{children}</Tag>;
}
```

Shader host with complete teardown:

```tsx
export function ShaderHero() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let api: { destroy(): void } | null = null;
    let cancelled = false;

    import('./gl/aurora.js').then(({ mountAurora }) => {
      if (cancelled) return;
      api = mountAurora(host);
    });

    return () => { cancelled = true; api?.destroy(); };
  }, []);

  return <div ref={hostRef} className="hero__gl" aria-hidden="true" />;
}
```

Rules:

- `useEffect`, never `useLayoutEffect`, for observers and GPU work.
- Cleanup must cancel the dynamic import (`cancelled`) or a StrictMode remount mounts twice.
- Do not create a rAF loop in render. Ever.
- Prefer CSS for reveals; use JS only for split text and scroll-linked values.
- If you need a shared reveal registry, put it in a module-level singleton with a ref count,
  not in context (context re-renders the tree on every observer event).

---

## 3. Next.js (App Router)

```tsx
// app/page.tsx  (server component)
import { Hero } from '@/components/hero';
import dynamic from 'next/dynamic';

const ShaderField = dynamic(() => import('@/components/shader-field'), {
  ssr: false,
  loading: () => <div className="hero__gl-fallback" />,
});

export default function Page() {
  return (
    <main id="main">
      <Hero />
      <ShaderField />
    </main>
  );
}
```

- Anything touching `window`, `matchMedia`, `IntersectionObserver`, or WebGL must be a client
  component (`"use client"`) **and** dynamically imported with `ssr: false`.
- Fonts via `next/font` so the metric override is generated for you:

```tsx
import { Geist } from 'next/font/google';
const geist = Geist({ subsets: ['latin'], display: 'swap', variable: '--font-sans' });
```

- Reveal wrappers belong in client components; do not turn the whole page into a client
  component to get one animation.
- CSS: import `tokens.css` in `app/layout.tsx`, keep motion CSS global (it is shared).
- Avoid `framer-motion` for a page that only needs reveals — it costs ~40KB gzip for
  behaviour the 1.5KB observer above already provides. Use it only if the project already has it.

---

## 4. Astro

Islands are the natural fit: ship zero JS for static sections, hydrate only the shader.

```astro
---
import Hero from '../components/Hero.astro';
import ShaderField from '../components/ShaderField.jsx';
---
<main id="main">
  <Hero />
  <ShaderField client:visible />
</main>
```

- `client:visible` for the shader (loads when scrolled into view), `client:idle` for the nav.
- Everything else stays server-rendered HTML — no hydration, no cost.
- Reveals can run from one small inline `<script>` at the page level.

---

## 5. Svelte 5 / Vue 3

```svelte
<script>
  import { onMount } from 'svelte';
  let host;
  onMount(() => {
    let api;
    let cancelled = false;
    import('./gl/aurora.js').then((m) => { if (!cancelled) api = m.mountAurora(host); });
    return () => { cancelled = true; api?.destroy(); };
  });
</script>
<div bind:this={host} class="hero__gl" aria-hidden="true"></div>
```

```vue
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
const host = ref(null);
let api = null, cancelled = false;
onMounted(async () => {
  const m = await import('./gl/aurora.js');
  if (!cancelled) api = m.mountAurora(host.value);
});
onBeforeUnmount(() => { cancelled = true; api?.destroy(); });
</script>
<template><div ref="host" class="hero__gl" aria-hidden="true" /></template>
```

Same contract as React: cancel async mounts, destroy GPU resources, never loop outside the
component lifecycle.

---

## 6. Tailwind v4

Map the tokens into the theme so utilities and component CSS share one source of truth:

```css
@import "tailwindcss";

@theme {
  --color-ink: #05070a;
  --color-ink-2: #0a0e12;
  --color-bone: #dfe7e0;
  --color-bone-dim: #aab4ad;
  --color-muted: #78837c;
  --color-accent: #e0231c;
  --color-accent-hot: #ff5a3c;
  --color-line: rgba(223, 231, 224, 0.13);

  --radius-card: 14px;
  --radius-control: 9px;

  --ease-out-quint: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-house: cubic-bezier(0.22, 0.61, 0.36, 1);

  --animate-rise: rise 0.62s cubic-bezier(0.16, 1, 0.3, 1) both;
  @keyframes rise {
    from { opacity: 0; transform: translate3d(0, 26px, 0); }
    to   { opacity: 1; transform: none; }
  }
}
```

Then:

```html
<h1 class="text-bone text-[clamp(34px,4.6vw,64px)] tracking-[-0.028em] leading-[1.05]">
```

Rules:

- Never use arbitrary values for colour or easing — only for fluid type, where `clamp()` in
  the config is worse than inline.
- Keep the reveal/mask CSS in a real stylesheet (`motion.css`), not as utilities. Multi-span
  mask structures do not survive utility purity.
- `motion-safe:` / `motion-reduce:` variants exist, but still write the global reduced-motion
  block — variants only cover the utilities you remembered to tag.

---

## 7. shadcn/ui and similar component libraries

- Re-point their CSS variables at your tokens (`--background`, `--foreground`, `--border`,
  `--ring`) rather than restyling each component.
- Set `--radius` to your `--r-md` and derive their scale from it.
- Their default ring is usually a blue; replace it with your accent at 68% alpha.
- Turn off their built-in animations if they conflict (most use `animate-in`, which is
  transform-based and compatible).

---

## 8. Multi-page sites

- Put tokens, layout, and motion in three shared files; never inline per page.
- The nav and footer are the same component; only the active-link attribute changes.
- Prefetch on hover for internal links of the next likely page (`<link rel="prefetch">` or the
  framework equivalent), never all pages.
- Page transitions: 300–450ms crossfade is enough. Do not implement a full-page wipe unless
  the brand justifies it, and never on the first load.

---

## 9. If the project already has a stack

Do not migrate. Adapt:

| Existing | Do this |
| --- | --- |
| Bootstrap / Tailwind default theme | Keep the framework; replace the tokens and remove its shadows/radii from the elements you touch |
| styled-components / Emotion | Put the tokens in a theme object, keep the motion in a global stylesheet |
| framer-motion | Use it for state transitions; keep scroll reveals in the observer registry (cheaper, no re-render) |
| GSAP already installed | Use it for one complex timeline; do not add ScrollTrigger **and** a scroll engine |
| jQuery | Do not add a second animation system. Write the reveal engine in plain JS |
| Three.js already installed | Use it for the signature scene; do not also add a raw-WebGL host |

The rule: **one motion engine per page.** Two libraries fighting over `transform` is the most
common cause of "it animates but it feels wrong".
