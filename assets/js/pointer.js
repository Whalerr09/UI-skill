/**
 * pointer.js — pointer-only enhancements.
 *
 *   <a class="btn" data-magnetic>…</a>          pull toward the cursor
 *   <div class="card" data-tilt>…</div>         subtle 3D tilt + specular
 *   <div class="cursor-glow"></div>             trailing accent light
 *
 * Everything here is gated on "(hover: hover) and (pointer: fine)" and on
 * prefers-reduced-motion, so touch devices pay zero cost and motion-sensitive
 * visitors get nothing at all. All listeners are removed by destroy().
 */

const FINE = '(hover: hover) and (pointer: fine)';
const REDUCE = '(prefers-reduced-motion: reduce)';

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

function canUsePointer() {
  return (
    typeof matchMedia === 'function' &&
    matchMedia(FINE).matches &&
    !matchMedia(REDUCE).matches
  );
}

/* ------------------------------------------------------------ cursor glow */

function initGlow(host, strength = 0.12) {
  const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const current = { ...target };
  let raf = 0;
  let visible = false;

  const render = () => {
    raf = 0;
    current.x += (target.x - current.x) * strength;
    current.y += (target.y - current.y) * strength;
    host.style.transform = `translate3d(${current.x.toFixed(1)}px, ${current.y.toFixed(1)}px, 0)`;
    if (Math.abs(target.x - current.x) > 0.4 || Math.abs(target.y - current.y) > 0.4) {
      raf = requestAnimationFrame(render);
    }
  };

  const wake = () => {
    if (!raf) raf = requestAnimationFrame(render);
  };

  const onMove = (event) => {
    target.x = event.clientX;
    target.y = event.clientY;
    if (!visible) {
      visible = true;
      host.classList.add('is-on');
    }
    wake();
  };

  const onLeave = () => {
    visible = false;
    host.classList.remove('is-on');
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave, { passive: true });
  wake();

  return () => {
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerleave', onLeave);
    host.classList.remove('is-on');
  };
}

/* -------------------------------------------------------------- magnetic */

function initMagnetic(el, strength = 0.22) {
  let raf = 0;
  let tx = 0;
  let ty = 0;
  let cx = 0;
  let cy = 0;

  const apply = () => {
    raf = 0;
    cx += (tx - cx) * 0.18;
    cy += (ty - cy) * 0.18;
    el.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`;
    if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
      raf = requestAnimationFrame(apply);
    }
  };

  const wake = () => {
    if (!raf) raf = requestAnimationFrame(apply);
  };

  const onMove = (event) => {
    const rect = el.getBoundingClientRect();
    tx = (event.clientX - rect.left - rect.width / 2) * strength;
    ty = (event.clientY - rect.top - rect.height / 2) * strength;
    wake();
  };

  const onLeave = () => {
    tx = 0;
    ty = 0;
    wake();
  };

  el.addEventListener('pointermove', onMove, { passive: true });
  el.addEventListener('pointerleave', onLeave, { passive: true });

  return () => {
    if (raf) cancelAnimationFrame(raf);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', onLeave);
    el.style.transform = '';
  };
}

/* ------------------------------------------------------------------ tilt */

function initTilt(el, max = 7) {
  let raf = 0;
  let rect = null;

  const specular = el.querySelector('[data-tilt-specular]');

  const measure = () => {
    rect = el.getBoundingClientRect();
  };

  const apply = (event) => {
    raf = 0;
    if (!rect) return;
    const px = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const py = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    const rx = (0.5 - py) * max * 2;
    const ry = (px - 0.5) * max * 2;

    el.style.transform =
      `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateZ(0)`;

    if (specular) {
      specular.style.background =
        `radial-gradient(45% 45% at ${(px * 100).toFixed(1)}% ${(py * 100).toFixed(1)}%, rgba(255,255,255,.18), transparent 70%)`;
    }
  };

  const onEnter = () => {
    measure();
    el.style.willChange = 'transform';
  };

  const onMove = (event) => {
    if (!rect) measure();
    if (!raf) raf = requestAnimationFrame(() => apply(event));
  };

  const onLeave = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    el.style.transform = '';
    el.style.willChange = 'auto';
    if (specular) specular.style.background = '';
  };

  el.addEventListener('pointerenter', onEnter, { passive: true });
  el.addEventListener('pointermove', onMove, { passive: true });
  el.addEventListener('pointerleave', onLeave, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('scroll', measure, { passive: true });

  return () => {
    if (raf) cancelAnimationFrame(raf);
    el.removeEventListener('pointerenter', onEnter);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('resize', measure);
    window.removeEventListener('scroll', measure);
    el.style.transform = '';
    el.style.willChange = 'auto';
  };
}

/* ----------------------------------------------------------------- mount */

export function initPointer(root = document) {
  if (!canUsePointer()) return { destroy() {}, enabled: false };

  const cleanups = [];

  const glow = root.querySelector('.cursor-glow');
  if (glow) cleanups.push(initGlow(glow));

  for (const el of root.querySelectorAll('[data-magnetic]')) {
    cleanups.push(initMagnetic(el, Number(el.dataset.magnetic) || 0.22));
  }

  for (const el of root.querySelectorAll('[data-tilt]')) {
    cleanups.push(initTilt(el, Number(el.dataset.tilt) || 7));
  }

  return {
    enabled: true,
    destroy() {
      for (const fn of cleanups) fn();
    },
  };
}
