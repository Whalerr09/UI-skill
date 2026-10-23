/**
 * preloader.js — a curtain that earns its place.
 *
 * Rules it follows:
 *   - never shows for a fast load (avoids a flash of "loading" on a warm cache)
 *   - never blocks content past `maxDuration`, whatever the network does
 *   - progress reflects real work (fonts + images), not a fake timer
 *   - lock is released in every path, including errors
 *   - reduced motion: still shown, but with no animated bar and no exit scale
 *   - session-scoped: skipped on return visits within the same tab session
 *
 * Markup:
 *   <div id="pre" class="pre" aria-hidden="true">
 *     <div class="pre__inner">
 *       <div class="pre__bar"><i></i></div>
 *       <div class="pre__meta"><span>Loading</span><b>0%</b></div>
 *     </div>
 *   </div>
 */

const SESSION_KEY = 'ui-motion-preloaded';

const reduced = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolve when every <img> currently in the document has settled. */
function imagesSettled(timeout = 6000) {
  const images = [...document.images];
  if (!images.length) return Promise.resolve();

  const pending = images.filter((img) => !img.complete);
  if (!pending.length) return Promise.resolve();

  return Promise.race([
    Promise.all(
      pending.map(
        (img) =>
          new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          }),
      ),
    ),
    wait(timeout),
  ]);
}

export function initPreloader(options = {}) {
  const {
    element = document.querySelector('#pre'),
    minDuration = 700,
    maxDuration = 4200,
    skipIfSeen = true,
    onDone,
  } = options;

  if (!element) return { destroy() {} };

  const bar = element.querySelector('.pre__bar i');
  const percent = element.querySelector('.pre__meta b');

  let destroyed = false;
  let finished = false;
  let progress = 0;
  let raf = 0;

  const write = (value) => {
    progress = Math.min(Math.max(value, 0), 1);
    if (bar) bar.style.right = `${((1 - progress) * 100).toFixed(2)}%`;
    if (percent) percent.textContent = `${Math.round(progress * 100)}%`;
  };

  const unlock = () => {
    document.body.classList.remove('is-locked');
    document.documentElement.style.removeProperty('overflow');
  };

  const finish = () => {
    if (finished || destroyed) return;
    finished = true;

    write(1);
    unlock();

    const done = () => {
      element.classList.add('done');
      element.hidden = false;
      try {
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch {
        /* storage can be unavailable; the preloader still works */
      }
      onDone?.();
      // Remove after the exit transition so it cannot trap focus or clicks.
      setTimeout(() => element.remove(), reduced() ? 0 : 900);
    };

    if (reduced()) {
      done();
      return;
    }

    // One frame at 100% before the curtain lifts, so the bar never jumps.
    setTimeout(done, 220);
  };

  const hasSeen = (() => {
    try {
      return skipIfSeen && sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      return false;
    }
  })();

  if (hasSeen) {
    element.remove();
    unlock();
    return { destroy() {} };
  }

  element.hidden = false;
  document.body.classList.add('is-locked');
  write(0.02);

  const startedAt = performance.now();

  // Trickle toward 90% while the real work happens; jump to 100% when it lands.
  const trickle = (now) => {
    if (destroyed || finished) return;
    const elapsed = now - startedAt;
    const cap = 0.9;
    const next = Math.min(cap, 0.02 + (elapsed / maxDuration) * cap);
    if (next > progress) write(next);
    raf = requestAnimationFrame(trickle);
  };
  raf = requestAnimationFrame(trickle);

  const watchdog = setTimeout(finish, maxDuration);

  Promise.all([
    document.fonts?.ready ?? Promise.resolve(),
    imagesSettled(),
    wait(minDuration),
  ])
    .then(() => {
      clearTimeout(watchdog);
      finish();
    })
    .catch(() => {
      clearTimeout(watchdog);
      finish();
    });

  return {
    destroy() {
      destroyed = true;
      clearTimeout(watchdog);
      if (raf) cancelAnimationFrame(raf);
      unlock();
    },
  };
}

/**
 * Optional CSS to pair with this script — keep it in the page's own stylesheet:
 *
 * #pre {
 *   position: fixed; inset: 0; z-index: 100;
 *   display: grid; place-items: center;
 *   background: var(--page);
 *   transition: opacity .8s var(--ease), visibility .8s;
 * }
 * #pre.done { opacity: 0; visibility: hidden; pointer-events: none; }
 * .pre__bar { position: relative; height: 1px; background: var(--line); overflow: hidden; }
 * .pre__bar i { position: absolute; inset: 0 100% 0 0; background: var(--fg); transition: right .35s linear; }
 * .pre__meta { display: flex; justify-content: space-between; margin-top: 12px;
 *   font-family: var(--font-mono); font-size: 10px; letter-spacing: .2em;
 *   text-transform: uppercase; color: var(--fg-faint); }
 */
