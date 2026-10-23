# 04 — WebGL and shaders

When to use a GPU, how to host it without leaking, and how to write shaders that look
authored rather than like a Shadertoy import.

---

## 1. Decision ladder — earn the canvas

Try each rung before climbing:

| Rung | Technique | Cost | Use for |
| --- | --- | --- | --- |
| 1 | CSS gradients + `conic-gradient` + `mask-image` | 0 | Glows, beams, rings, soft light, grain |
| 2 | SVG filters (`feTurbulence`, `feDisplacementMap`) | ~0 (static) | Organic edges, noise texture, paper grain |
| 3 | Canvas 2D + `requestAnimationFrame` | low | Particles, starfields, cursor trails, dot grids |
| 4 | Raw WebGL fullscreen fragment shader | ~8KB, GPU | Volumetric fog, fBm noise, liquid metal, iridescence |
| 5 | Three.js geometry + lights + post | 120KB+ | Real 3D objects, refraction, depth, orbit |

Rules:

- Rungs 1–2 are almost always enough for a background. A well-made gradient stack with
  grain beats a mediocre shader.
- Use rung 4 when the effect must be *per-pixel* and *moving*.
- Use rung 5 only when the object has form the visitor must recognise (a device, a bottle,
  a sculpture) or must rotate.
- One rung-4 or rung-5 surface per page. One. A second one halves the frame budget and
  doubles the teardown surface for zero added meaning.

---

## 2. The host lifecycle contract

Every GPU surface on the page implements all eight of these. Missing any one is a bug that
shows up as a hot laptop, a frozen tab, or a "context lost" banner.

| # | Requirement | Why |
| --- | --- | --- |
| 1 | Size the backing store to `clientWidth × min(devicePixelRatio, 2)` | 3× DPR on a 4K phone quadruples fragment work for invisible gain |
| 2 | `ResizeObserver` on the host, not `window.resize` | Handles layout changes, sidebars, fonts, orientation |
| 3 | `IntersectionObserver` → start/stop | Offscreen shaders are pure waste |
| 4 | `visibilitychange` → stop/resume | A hidden tab must not render |
| 5 | Guard the loop: one rAF handle, never two | Double `start()` calls are the #1 rAF leak |
| 6 | Reduced motion → render exactly one frame, then stop | Ambient motion is the trigger for vestibular symptoms |
| 7 | `webglcontextlost` → preventDefault; `restored` → reinit | Mobile GPUs drop contexts on tab switch |
| 8 | Teardown: delete program, shaders, buffers, textures; disconnect observers; remove listeners | SPA route changes otherwise leak whole renderers |

The canonical implementation is `assets/js/gl/ShaderCanvas.js`. Read it once; every shader
host you write should be a variation of it.

Skeleton:

```js
export function createShaderCanvas(host, { fragment, uniforms = {}, dprCap = 2 }) {
  const canvas = document.createElement('canvas');
  host.append(canvas);
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false });
  if (!gl) return { destroy() {} };            // caller keeps its CSS fallback

  let raf = 0, visible = true, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const started = performance.now();

  function resize() {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    const dpr = Math.min(devicePixelRatio || 1, dprCap);
    const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw; canvas.height = bh;
      gl.viewport(0, 0, bw, bh);
    }
    gl.uniform2f(uRes, bw, bh);
  }

  function render(now) {
    raf = 0;
    gl.uniform1f(uTime, reduced ? 0 : (now - started) * 0.001);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduced && visible && !document.hidden) raf = requestAnimationFrame(render);
  }

  function start() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(render); }
  function stop()  { if (raf) cancelAnimationFrame(raf); raf = 0; }

  // … observers, listeners, program setup …

  return { destroy() { stop(); /* delete GL objects, disconnect, remove listeners */ } };
}
```

---

## 3. The fullscreen triangle

One triangle, not a quad. It covers the viewport with no seam, no index buffer, and three
vertices.

```js
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(program, 'p');
gl.enableVertexAttribArray(loc);
gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
```

```glsl
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
```

The fragment shader gets a normalised coordinate from the position directly — no varying
needed:

```glsl
precision highp float;
uniform vec2  uRes;
uniform float uT;

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
  vec3 col = vec3(0.0);
  /* … */
  gl_FragColor = vec4(col, 1.0);
}
```

Dividing by `min(uRes.x, uRes.y)` keeps the field circular regardless of aspect ratio —
the single most common reason a shader looks stretched on mobile.

---

## 4. Authoring shaders that look designed

### Noise

```glsl
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}
```

Loop count is the cost dial: 3 octaves for backgrounds, 5 for hero, 6+ never.
`p *= 2.02` (not `2.0`) avoids visible lattice alignment.

### Palette in the shader

Do not hardcode one hue. Feed two colours as uniforms derived from the design tokens so the
shader always matches the site:

```js
gl.uniform3fv(uColA, hexToRgb(getComputedStyle(document.documentElement).getPropertyValue('--accent')));
```

```glsl
vec3 col = mix(uColA, uColB, smoothstep(0.2, 0.85, n));
col += pow(n, 6.0) * 0.6;          // hot core
col *= 1.0 - 0.35 * length(uv);    // falloff toward edges
```

### Framing

| Technique | Code | Effect |
| --- | --- | --- |
| Vignette | `col *= 1.0 - 0.45 * smoothstep(0.4, 1.4, length(uv));` | Directs the eye to centre |
| Grain | `col += (hash(gl_FragCoord.xy) - 0.5) * 0.035;` | Removes banding in gradients |
| Chromatic edge | sample two offset copies, mix `.r` and `.b` | Lens realism, only near edges |
| Dither | `col += (hash(gl_FragCoord.xy + uT) - 0.5) / 255.0;` | Kills 8-bit banding on dark ramps |
| Time warp | `float t = uT * 0.15;` | Slow is expensive-looking; fast is cheap-looking |

### Slow is the whole trick

Ambient shaders should complete a visual cycle in 20–60 seconds. If you can see it moving
when you stare at one pixel, it is too fast.

---

## 5. Compositing with the DOM

The canvas is a *layer*, not a page. Layer order that works:

```
z 0    canvas / shader
z 1    scrim gradient  (absolute, pointer-events:none)
z 10   .page content
z 50   nav
z 55   vignette        (fixed, pointer-events:none)
z 60   grain           (fixed, pointer-events:none, mix-blend-mode:overlay)
z 100  preloader / modal
```

Key rules:

- Canvas gets `display:block; width:100%; height:100%; pointer-events:none;` and
  `aria-hidden="true"`. It is decoration.
- Put the *interaction* on the host element, not the canvas, if you need pointer input.
- If a cut-out image must pass **in front of** the nav, it must live outside the content
  wrapper (a sibling layer with a higher z-index). A child of a `z-index: 10` parent can
  never escape that stacking context — a bug that costs hours.
- Dark palettes: add a vignette. Without one, the shader's edges meet the page background
  and the frame looks unfinished.

---

## 6. Three.js — only when form matters

```js
import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(host.clientWidth, host.clientHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, host.clientWidth / host.clientHeight, 0.1, 100);
camera.position.set(0, 0, 4.2);

const geometry = new THREE.IcosahedronGeometry(1.35, 5);
const material = new THREE.MeshStandardMaterial({
  color: 0x101114, metalness: 1, roughness: 0.18,
  envMapIntensity: 1.2,
});
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);
```

Do not ship an environment map for one object. A cheap studio-light rig is lighter and
easier to art-direct:

```js
const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(2, 3, 4);
const rim = new THREE.DirectionalLight(0x88aaff, 1.6); rim.position.set(-3, -1, -2);
scene.add(key, rim, new THREE.AmbientLight(0x202028, 1));
```

Teardown is not optional:

```js
function dispose() {
  geometry.dispose();
  material.dispose();
  if (material.map) material.map.dispose();
  renderer.dispose();
  renderer.forceContextLoss();     // frees the GPU context immediately
  renderer.domElement.remove();
}
```

React 19 + StrictMode mounts, unmounts and remounts effects in development. If you do not
fully dispose, you will hit "too many WebGL contexts" on the third hot reload. Always
`forceContextLoss()` and null the refs.

---

## 7. Fallbacks that do not look like fallbacks

The CSS layer under the canvas must already look intentional:

```html
<div class="gl-hero" style="--gl-a:#e0231c; --gl-b:#0a0e12">
  <canvas class="gl-hero__canvas" aria-hidden="true"></canvas>
  <div class="gl-hero__fallback"></div>
</div>
```

```css
.gl-hero__fallback {
  position: absolute; inset: 0; z-index: 0;
  background:
    radial-gradient(60% 55% at 30% 35%, color-mix(in oklab, var(--gl-a) 55%, transparent), transparent 70%),
    radial-gradient(70% 60% at 75% 65%, color-mix(in oklab, var(--gl-b) 90%, black), transparent 72%),
    var(--ink);
}
.gl-hero__canvas { position: relative; z-index: 1; }
```

Decision order:

1. Shader fails to compile or no `webgl` context → hide the canvas, keep the fallback.
2. `prefers-reduced-motion` → render one frame of the shader (best still image) and stop.
3. Context lost → hide the canvas, show the fallback, attempt one re-init.
4. Save-Data / `navigator.connection.effectiveType === '2g'` → do not init at all.

---

## 8. Performance rules for fragment shaders

| Rule | Detail |
| --- | --- |
| Resolution scaling | On weak GPUs, render at `0.75×` and upscale with CSS. Imperceptible for soft fields |
| No loops over textures | Sample once per tap; texture lookups dominate cost |
| Avoid `sin`/`pow` in inner loops | Precompute, or use polynomial approximations |
| `precision highp` only when needed | `mediump` is 2× faster on mobile for colour fields |
| No `discard` in a fullscreen pass | Breaks early-Z and some mobile tiling GPUs |
| One pass | Multi-pass = multiple framebuffers = mobile black screens |
| Cap frame rate for slow ambient | A 30fps ambient field is indistinguishable from 60 and halves the power |

Throttle ambient work:

```js
const MIN_STEP = 1000 / 30;
let last = 0;
function render(now) {
  raf = 0;
  if (now - last < MIN_STEP) { raf = requestAnimationFrame(render); return; }
  last = now;
  /* draw */
  raf = requestAnimationFrame(render);
}
```

---

## 9. Shader checklist

- [ ] Backing store = CSS size × `min(DPR, 2)`.
- [ ] `uv` normalised by `min(width, height)`.
- [ ] Starts paused, starts from a lifecycle hook, stops when offscreen/hidden.
- [ ] Exactly one rAF handle; `start()` is idempotent.
- [ ] Reduced motion renders one still frame.
- [ ] Colours come from tokens, not literals.
- [ ] Canvas is `aria-hidden` and `pointer-events: none`.
- [ ] CSS fallback is visually complete on its own.
- [ ] Context-loss handler present.
- [ ] Full teardown on unmount, including `forceContextLoss()` for Three.js.
- [ ] ≤ 2 GPU contexts on the whole page.
- [ ] No console warnings about shader precision or attribute locations.
