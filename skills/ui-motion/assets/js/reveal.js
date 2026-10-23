/**
 * reveal.js — one IntersectionObserver for the whole page.
 *
 * Usage:
 *   <h1 data-rv="words">Where stillness reveals the unseen</h1>
 *   <p data-rv="up">…</p>
 *   <div class="grid">
 *     <article data-rv="up">…</article>   <!-- siblings auto-stagger -->
 *     <article data-rv="up">…</article>
 *   </div>
 *   <b data-count="12400">12,400</b>
 *
 * Contract:
 *   - content stays visible without JS (the hidden state is gated by html.js)
 *   - every element is unobserved after it fires
 *   - prefers-reduced-motion shows everything instantly and stops listening
 *   - one stagger index per parent, capped, never unbounded
 *
 * @param {Document|HTMLElement} [root=document]
 * @param {{ selector?: string, stagger?: number, cap?: number, rootMargin?: string }} [options]
 * @returns {{ refresh: () => void, destroy: () => void }}
 */

const STAGGER_DEFAULT = 85;
const CAP_DEFAULT = 420;
const ROOT_MARGIN = '0px 0px -10% 0px';
const THRESHOLD = 0.04;

const reducedQuery = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Split a heading into masked word spans. Returns true if it did any work. */
export function splitWords(heading, step = 72) {
  if (heading.dataset.words === 'true') return false;

  const phrase = heading.textContent.replace(/\s+/g, ' ').trim();
  if (!phrase) return false;

  // Preserve the accessible name before the DOM is rewritten.
  heading.dataset.words = 'true';
  heading.setAttribute('aria-label', phrase);
  heading.textContent = '';

  phrase.split(' ').forEach((word, index) => {
    if (index) heading.append(document.createTextNode(' '));

    const mask = document.createElement('span');
    mask.className = 'word-mask';
    mask.setAttribute('aria-hidden', 'true');

    const inner = document.createElement('span');
    inner.className = 'word';
    inner.textContent = word;
    inner.style.setProperty('--word-delay', `${index * step}ms`);

    mask.append(inner);
    heading.append(mask);
  });

  return true;
}

/** Assign a stagger index to each sibling group so motion follows reading order. */
function assignStagger(items, stagger, cap) {
  const groups = new Map();

  for (const el of items) {
    const parent = el.parentElement || document.body;
    const list = groups.get(parent);
    if (list) list.push(el);
    else groups.set(parent, [el]);
  }

  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.forEach((el, index) => {
      const delay = Math.min(index * stagger, cap);
      el.dataset.rvd = String(delay);
      el.style.setProperty('--rv-delay', `${delay}ms`);
    });
  }
}

export function initReveal(root = document, options = {}) {
  const {
    selector = '[data-rv], .word-reveal',
    stagger = STAGGER_DEFAULT,
    cap = CAP_DEFAULT,
    rootMargin = ROOT_MARGIN,
  } = options;

  let observer = null;
  let reduced = reducedQuery();

  /** Show an element, honouring its data-rvd delay. */
  const fire = (el) => {
    const delay = reduced ? 0 : Number(el.dataset.rvd || 0);
    if (!delay) {
      el.classList.add('rv-in');
      return;
    }
    setTimeout(() => el.classList.add('rv-in'), delay);
  };

  const collect = () => {
    const nodes = [];

    for (const el of root.querySelectorAll('[data-rv]')) {
      if (el.dataset.rv === 'words') {
        // Words animate individually; the heading itself must not fade as a block.
        if (reduced) continue;
        if (splitWords(el)) {
          el.removeAttribute('data-rv');
          el.classList.add('word-reveal');
          nodes.push(el);
        }
        continue;
      }
      nodes.push(el);
    }

    for (const el of root.querySelectorAll('.word-reveal')) {
      if (!nodes.includes(el)) nodes.push(el);
    }

    return nodes;
  };

  const build = () => {
    if (observer) observer.disconnect();
    observer = null;

    if (reduced) {
      for (const el of root.querySelectorAll(selector)) el.classList.add('rv-in');
      return;
    }

    const items = collect();
    if (!items.length) return;

    assignStagger(items, stagger, cap);

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          fire(entry.target);
        }
      },
      { rootMargin, threshold: THRESHOLD },
    );

    const viewportGate = window.innerHeight * 0.92;

    for (const el of items) {
      if (el.classList.contains('rv-in')) continue;
      // Anything already on screen at load must not wait for a scroll event.
      if (el.getBoundingClientRect().top < viewportGate) fire(el);
      else observer.observe(el);
    }
  };

  build();

  const onMotionChange = (event) => {
    reduced = event.matches;
    build();
  };

  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  media?.addEventListener?.('change', onMotionChange);

  return {
    refresh: build,
    destroy() {
      observer?.disconnect();
      observer = null;
      media?.removeEventListener?.('change', onMotionChange);
    },
  };
}

/**
 * Count-up numbers. The final value is already in the HTML, so crawlers and
 * no-JS visitors read the real figure; this only animates the first appearance.
 */
export function initCounters(root = document, duration = 1400) {
  const els = [...root.querySelectorAll('[data-count]')];
  if (!els.length) return { destroy() {} };

  const reduced = reducedQuery();
  const seen = new WeakSet();

  const run = (el) => {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target)) return;

    const formatter = new Intl.NumberFormat(el.dataset.locale || undefined);
    const start = el.dataset.prefix || '';
    const end = el.dataset.suffix || '';

    if (reduced) {
      el.textContent = `${start}${formatter.format(target)}${end}`;
      return;
    }

    const t0 = performance.now();
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
      const t = Math.min((now - t0) / duration, 1);
      const value = Math.round(target * easeOutCubic(t));
      el.textContent = `${start}${formatter.format(value)}${end}`;
      if (t < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || seen.has(entry.target)) continue;
        seen.add(entry.target);
        observer.unobserve(entry.target);
        run(entry.target);
      }
    },
    { threshold: 0.4 },
  );

  for (const el of els) observer.observe(el);

  return {
    destroy() {
      observer.disconnect();
    },
  };
}

/** Convenience mount used by the demo page and by plain-script projects. */
export function mountMotion(root = document) {
  const reveal = initReveal(root);
  const counters = initCounters(root);
  return {
    refresh: reveal.refresh,
    destroy() {
      reveal.destroy();
      counters.destroy();
    },
  };
}
