/**
 * scroll.js — the only scroll listener on the page.
 *
 * Publishes, on <html>:
 *   --scroll-y    current scroll offset in px
 *   --scroll-p    document progress 0..1
 *   data-scroll-dir  "down" | "up"
 *   .is-scrolled  when scrollY > 24
 *
 * Consumers subscribe with on(fn) and receive { y, progress, velocity, dir }.
 * Nothing here reads layout inside the scroll event: rects are cached by an
 * IntersectionObserver + ResizeObserver and refreshed once per resize.
 */

const REDUCED = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const smoothstep = (t) => t * t * (3 - 2 * t);

/* ------------------------------------------------------------------ engine */

export function initScroll() {
  const subscribers = new Set();
  const root = document.documentElement;

  let queued = false;
  let running = true;
  let lastY = window.scrollY;
  let velocity = 0;
  let direction = 1;
  let progress = 0;

  const notify = () => {
    const payload = { y: lastY, progress, velocity, dir: direction };
    for (const fn of subscribers) {
      try {
        fn(payload);
      } catch (error) {
        console.error('[scroll] subscriber failed', error);
      }
    }
  };

  const frame = () => {
    queued = false;
    if (!running) return;

    const y = window.scrollY;
    const delta = y - lastY;

    if (Math.abs(delta) > 1) {
      direction = delta > 0 ? 1 : -1;
      root.dataset.scrollDir = direction > 0 ? 'down' : 'up';
    }

    velocity = delta;
    lastY = y;

    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress = max > 0 ? clamp(y / max, 0, 1) : 0;

    root.style.setProperty('--scroll-y', `${Math.round(y)}`);
    root.style.setProperty('--scroll-p', progress.toFixed(4));
    root.classList.toggle('is-scrolled', y > 24);

    notify();
  };

  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  };

  const onResize = () => {
    onScroll();
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  onScroll();

  return {
    /** Subscribe to scroll state. Returns an unsubscribe function. */
    on(fn) {
      subscribers.add(fn);
      fn({ y: lastY, progress, velocity: 0, dir: direction });
      return () => subscribers.delete(fn);
    },
    get state() {
      return { y: lastY, progress, velocity, dir: direction };
    },
    destroy() {
      running = false;
      subscribers.clear();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    },
  };
}

/* --------------------------------------------------------------------- nav */

/**
 * Sticky nav: `stuck` from a sentinel observer, `hide` from scroll direction.
 * The sentinel must be the first element in the body (#top-sentinel).
 */
export function initNav(engine, nav = document.querySelector('.nav'), sentinel = document.querySelector('#top-sentinel')) {
  if (!nav) return { destroy() {} };

  let stuck = false;

  const observer = sentinel
    ? new IntersectionObserver(
        ([entry]) => {
          stuck = !entry.isIntersecting;
          nav.classList.toggle('stuck', stuck);
        },
        { threshold: 1 },
      )
    : null;

  observer?.observe(sentinel);

  let anchor = 0;

  const off = engine.on(({ y, dir }) => {
    if (y < 200) {
      nav.classList.remove('hide');
      anchor = y;
      return;
    }
    if (Math.abs(y - anchor) < 6) return; // ignore jitter
    nav.classList.toggle('hide', dir > 0 && y > anchor);
    anchor = y;
  });

  return {
    destroy() {
      observer?.disconnect();
      off();
    },
  };
}

/* ---------------------------------------------------------------- progress */

/** Progress bar: reads --scroll-p, so it needs no JS here. Kept for parity. */
export function initProgress() {
  return { destroy() {} };
}

/* ---------------------------------------------------------------- parallax */

/**
 * Parallax from data attributes:
 *   <div data-parallax="0.08">   positive moves slower than the page
 * Only runs on fine pointers and at >= 768px, and never under reduced motion.
 */
export function initParallax(engine, root = document) {
  const nodes = [...root.querySelectorAll('[data-parallax]')];
  if (!nodes.length) return { destroy() {} };
  if (REDUCED() || window.innerWidth < 768) return { destroy() {} };

  const layers = nodes.map((el) => ({
    el,
    factor: Number(el.dataset.parallax) || 0.06,
    rect: null,
  }));

  const measure = () => {
    for (const layer of layers) {
      // Cache document-space top so the scroll frame never measures.
      layer.rect = layer.el.getBoundingClientRect().top + window.scrollY;
    }
  };

  measure();
  window.addEventListener('resize', measure, { passive: true });

  const off = engine.on(({ y }) => {
    for (const layer of layers) {
      if (!layer.rect) continue;
      const offset = (y - layer.rect + window.innerHeight) * layer.factor;
      layer.el.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
    }
  });

  return {
    destroy() {
      off();
      window.removeEventListener('resize', measure);
      for (const layer of layers) layer.el.style.transform = '';
    },
  };
}

/* -------------------------------------------------------------- hero exit */

/**
 * Hero stand-down. Mark elements with data-hero-exit and, optionally,
 * data-at / data-span / data-blur:
 *
 *   <div data-hero-exit data-at="0" data-span=".26" data-blur="10">
 *
 * Writes only while progress > 0 and restores everything at 0, so the page's
 * own entrance reveal is never pre-empted on load.
 */
export function initHeroExit(engine, hero = document.querySelector('.hero')) {
  if (!hero || REDUCED()) return { destroy() {} };

  const seq = [...hero.querySelectorAll('[data-hero-exit]')].map((el) => ({
    el,
    at: Number(el.dataset.at || 0),
    span: Number(el.dataset.span || 0.3),
    blur: Number(el.dataset.blur || 0),
    shift: el.dataset.shift !== 'false',
  }));

  if (!seq.length) return { destroy() {} };

  let active = false;

  const reset = () => {
    for (const item of seq) {
      item.el.style.opacity = '';
      item.el.style.transform = '';
      item.el.style.filter = '';
    }
    active = false;
  };

  const off = engine.on(({ y }) => {
    const distance = Math.max(hero.offsetHeight - window.innerHeight, 1);
    const p = clamp(y / distance, 0, 1);

    if (p <= 0.001) {
      if (active) reset();
      return;
    }
    active = true;

    for (const item of seq) {
      const t = clamp((p - item.at) / item.span, 0, 1);
      const e = smoothstep(t);
      item.el.style.opacity = String(1 - e);
      if (item.shift) item.el.style.transform = `translate3d(0, ${(-e * 18).toFixed(2)}px, 0)`;
      if (item.blur) item.el.style.filter = e > 0.01 ? `blur(${(e * item.blur).toFixed(1)}px)` : '';
    }
  });

  return {
    destroy() {
      off();
      reset();
    },
  };
}

/* ------------------------------------------------------------ pinned story */

/**
 * Pinned narrative: <section class="story"> with .story__steps li[data-step]
 * The section height comes from CSS; here we only map progress to the step.
 */
export function initStory(engine, section = document.querySelector('.story')) {
  if (!section) return { destroy() {} };

  const steps = [...section.querySelectorAll('.story__steps li')];
  if (!steps.length) return { destroy() {} };

  if (REDUCED() || window.innerWidth < 1024) {
    for (const step of steps) step.classList.add('is-active');
    return { destroy() {} };
  }

  const pin = section.querySelector('.story__pin');
  let rect = null;
  let current = -1;

  const measure = () => {
    rect = section.getBoundingClientRect().top + window.scrollY;
  };
  measure();
  window.addEventListener('resize', measure, { passive: true });

  const off = engine.on(({ y }) => {
    if (rect === null) return;
    const span = Math.max(section.offsetHeight - window.innerHeight, 1);
    const p = clamp((y - rect) / span, 0, 0.9999);

    // Only write the step when the index actually changes.
    const index = Math.min(Math.floor(p * steps.length), steps.length - 1);
    if (index !== current) {
      steps.forEach((step, i) => step.classList.toggle('is-active', i === index));
      current = index;
    }

    pin?.style.setProperty('--story-p', p.toFixed(4));
  });

  return {
    destroy() {
      off();
      window.removeEventListener('resize', measure);
    },
  };
}

/* ------------------------------------------------------------------ mount */

/** Wire every scroll consumer in one call. */
export function mountScroll(root = document) {
  const engine = initScroll();
  const parts = [
    initNav(engine, root.querySelector('.nav'), root.querySelector('#top-sentinel')),
    initParallax(engine, root),
    initHeroExit(engine, root.querySelector('.hero')),
    initStory(engine, root.querySelector('.story')),
  ];

  return {
    engine,
    destroy() {
      for (const part of parts) part.destroy();
      engine.destroy();
    },
  };
}
