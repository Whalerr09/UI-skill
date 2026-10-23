/**
 * orb.js — Three.js metal orb with a cheap studio rig.
 *
 * OPTIONAL. Only use this when the object has form the visitor must recognise
 * or must rotate. For ambient background light, use the raw-WebGL aurora —
 * it is ~8KB instead of ~140KB.
 *
 * Requires: npm i three
 *
 * Usage:
 *   import { mountOrb } from './orb.js';
 *   const orb = mountOrb(host, { hue: '--accent' });
 *   // later
 *   orb.destroy();
 *
 * Lifecycle is identical to ShaderCanvas: DPR clamp, offscreen pause, hidden-tab
 * pause, reduced-motion still frame, full dispose including forceContextLoss().
 */

import * as THREE from 'three';
import { colorFromToken } from './ShaderCanvas.js';

const reducedQuery = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * @param {HTMLElement} host
 * @param {{
 *   hue?: string,            // CSS token name for the light colour
 *   rim?: string,            // CSS token name for the rim light
 *   detail?: number,         // icosahedron detail, 3..6 (5 ≈ 10k tris)
 *   roughness?: number,
 *   speed?: number,          // radians per second
 *   dprCap?: number,
 * }} options
 */
export function mountOrb(host, options = {}) {
  const noop = { destroy() {} };
  if (!host) return noop;

  const {
    hue = '--accent',
    rim = '--accent-hot',
    detail = 5,
    roughness = 0.2,
    speed = 0.14,
    dprCap = 2,
  } = options;

  const width = Math.max(1, host.clientWidth);
  const height = Math.max(1, host.clientHeight);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.setSize(width, height, false);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.cssText =
    'position:absolute;inset:0;z-index:1;display:block;width:100%;height:100%;pointer-events:none;';
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
  camera.position.set(0, 0, 4.4);

  const geometry = new THREE.IcosahedronGeometry(1.36, Math.min(Math.max(detail, 2), 6));

  const accent = colorFromToken(hue, [1, 1, 1]);
  const rimColor = colorFromToken(rim, [0.8, 0.9, 1]);

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setRGB(accent[0] * 0.12, accent[1] * 0.12, accent[2] * 0.12),
    metalness: 1,
    roughness,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const key = new THREE.DirectionalLight(new THREE.Color().setRGB(accent[0], accent[1], accent[2]), 2.6);
  key.position.set(2.4, 3, 4);
  const fill = new THREE.DirectionalLight(0xffffff, 0.9);
  fill.position.set(-3, 1, 2);
  const rimLight = new THREE.DirectionalLight(new THREE.Color().setRGB(rimColor[0], rimColor[1], rimColor[2]), 1.8);
  rimLight.position.set(-3, -2, -2);
  scene.add(key, fill, rimLight, new THREE.AmbientLight(0x202028, 1.4));

  let raf = 0;
  let visible = true;
  let disposed = false;
  let reduced = reducedQuery();
  const clock = new THREE.Clock();

  const render = () => {
    raf = 0;
    if (disposed) return;
    if (!visible || document.hidden) return;

    const dt = Math.min(clock.getDelta(), 1 / 20);
    if (!reduced) {
      mesh.rotation.y += dt * speed;
      mesh.rotation.x = Math.sin(clock.elapsedTime * 0.22) * 0.12;
    }
    renderer.render(scene, camera);

    if (!reduced) raf = requestAnimationFrame(render);
  };

  const start = () => {
    if (disposed || raf || reduced || !visible || document.hidden) return;
    clock.getDelta();
    raf = requestAnimationFrame(render);
  };

  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const resize = () => {
    if (disposed) return;
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (reduced) renderer.render(scene, camera);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);

  const intersection = new IntersectionObserver(
    ([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) start();
      else stop();
    },
    { rootMargin: '10% 0px' },
  );
  intersection.observe(host);

  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const onMotion = (event) => {
    reduced = event.matches;
    if (reduced) {
      stop();
      renderer.render(scene, camera);
    } else {
      start();
    }
  };
  motionQuery.addEventListener('change', onMotion);

  // A lost context is unrecoverable for a scene of this size: dispose instead.
  renderer.domElement.addEventListener('webglcontextlost', () => stop(), false);

  renderer.render(scene, camera);
  start();

  return {
    destroy() {
      disposed = true;
      stop();
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener('change', onMotion);

      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

/**
 * Mount on approach. Prefer this over mountOrb for anything below the fold.
 */
export function lazyOrb(host, options = {}) {
  if (!host) return { destroy() {} };

  let api = null;
  let destroyed = false;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || api || destroyed) continue;
        observer.disconnect();
        api = mountOrb(host, options);
      }
    },
    { rootMargin: '200px 0px', threshold: 0.01 },
  );

  observer.observe(host);

  return {
    destroy() {
      destroyed = true;
      observer.disconnect();
      api?.destroy();
      api = null;
    },
  };
}
