/**
 * ShaderCanvas.js — a dependency-free fullscreen WebGL host.
 *
 * Implements the whole lifecycle contract from references/04-webgl-and-shaders.md:
 *   DPR clamp · ResizeObserver · IntersectionObserver pause · visibility pause ·
 *   reduced-motion still frame · context-loss recovery · complete teardown ·
 *   CSS fallback when GL is unavailable or a shader fails to compile.
 *
 * Usage:
 *   import { createShaderCanvas, colorFromToken } from './ShaderCanvas.js';
 *
 *   const field = createShaderCanvas(host, {
 *     fragment: AURORA_FRAGMENT,
 *     autoColors: { uColA: '--accent', uColB: '--ink-3' },
 *     uniforms: { uSpeed: { type: '1f', value: 0.4 } },
 *     dprCap: 2,
 *     fps: 60,
 *   });
 *
 *   // later
 *   field.destroy();
 *
 * The host element must have a size and should already contain the CSS fallback:
 *   <div class="hero__scene"><div class="scene-fallback"></div></div>
 */

const VERTEX_SOURCE = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const reducedQuery = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Read a CSS custom property and return [r,g,b] in 0..1, or the fallback. */
export function colorFromToken(name, fallback = [1, 1, 1]) {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!raw) return fallback;

  // #rgb / #rrggbb
  if (raw.startsWith('#')) {
    const hex = raw.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    const n = parseInt(full.slice(0, 6), 16);
    if (Number.isNaN(n)) return fallback;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  // rgb() / rgba()
  const match = raw.match(/rgba?\(([^)]+)\)/i);
  if (match) {
    const [r, g, b] = match[1].split(',').map((v) => parseFloat(v));
    return [r / 255, g / 255, b / 255];
  }

  return fallback;
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown compile error';
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function link(gl, vertexSource, fragmentSource) {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    throw new Error('Unable to create program');
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown link error';
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    throw new Error(log);
  }
  return { program, vertex, fragment };
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   fragment: string,
 *   uniforms?: Record<string, { type: '1f'|'2f'|'3f'|'1i', value: number|number[] }>,
 *   autoColors?: Record<string, string>,
 *   dprCap?: number,
 *   fps?: number,
 *   alpha?: boolean,
 *   className?: string,
 *   onError?: (error: Error) => void,
 * }} options
 */
export function createShaderCanvas(host, options) {
  const {
    fragment,
    uniforms: customUniforms = {},
    autoColors = {},
    dprCap = 2,
    fps = 60,
    alpha = true,
    className = 'shader-canvas',
    onError,
  } = options || {};

  const noop = { destroy() {}, pause() {}, resume() {}, start() {} };
  if (!host || !fragment) return noop;

  const canvas = document.createElement('canvas');
  canvas.className = className;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText =
    'position:absolute;inset:0;z-index:1;display:block;width:100%;height:100%;pointer-events:none;';
  host.append(canvas);

  const gl =
    canvas.getContext('webgl', {
      alpha,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    }) ||
    canvas.getContext('experimental-webgl', { alpha, premultipliedAlpha: false, antialias: false });

  const fail = (error) => {
    console.error('[ShaderCanvas]', error);
    canvas.remove();
    onError?.(error instanceof Error ? error : new Error(String(error)));
  };

  if (!gl) {
    fail(new Error('WebGL is unavailable'));
    return noop;
  }

  let program = null;
  let vertexShader = null;
  let fragmentShader = null;
  let buffer = null;

  const locations = new Map();
  const values = new Map();

  let raf = 0;
  let running = false;
  let visible = true;
  let disposed = false;
  let reduced = reducedQuery();
  let startedAt = performance.now();
  let lastFrame = 0;
  const minStep = fps > 0 ? 1000 / fps : 0;

  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const onMotionChange = (event) => {
    reduced = event.matches;
    startedAt = performance.now();
    if (reduced) {
      stopLoop();
      draw(0);
    } else {
      start();
    }
  };

  const location = (name) => {
    if (locations.has(name)) return locations.get(name);
    const loc = gl.getUniformLocation(program, name);
    locations.set(name, loc);
    return loc;
  };

  const uniform = (name, type, value) => {
    const loc = location(name);
    if (loc === null) return;
    switch (type) {
      case '2f':
        gl.uniform2f(loc, value[0], value[1]);
        break;
      case '3f':
        gl.uniform3f(loc, value[0], value[1], value[2]);
        break;
      case '1i':
        gl.uniform1i(loc, value);
        break;
      default:
        gl.uniform1f(loc, value);
    }
  };

  /* ------------------------------------------------------------- setup */

  const build = () => {
    try {
      const linked = link(gl, VERTEX_SOURCE, fragment);
      program = linked.program;
      vertexShader = linked.vertex;
      fragmentShader = linked.fragment;
      gl.useProgram(program);
    } catch (error) {
      fail(error);
      return false;
    }

    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);

    // Resolve declared uniforms once; colours come from CSS tokens.
    for (const [name, spec] of Object.entries(customUniforms)) {
      values.set(name, { type: spec.type, value: spec.value });
    }
    for (const [name, token] of Object.entries(autoColors)) {
      values.set(name, { type: '3f', value: colorFromToken(token, [1, 1, 1]) });
    }

    resize();
    return true;
  };

  const resize = () => {
    if (disposed || !program) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const bufferWidth = Math.max(1, Math.round(width * dpr));
    const bufferHeight = Math.max(1, Math.round(height * dpr));

    if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
      canvas.width = bufferWidth;
      canvas.height = bufferHeight;
    }
    gl.viewport(0, 0, bufferWidth, bufferHeight);
    uniform('uRes', '2f', [bufferWidth, bufferHeight]);
    if (!running && !reduced) draw(0);
  };

  const draw = (elapsedSeconds) => {
    if (disposed || !program) return;
    gl.useProgram(program);
    uniform('uT', '1f', elapsedSeconds);
    for (const [name, spec] of values) uniform(name, spec.type, spec.value);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  /* -------------------------------------------------------------- loop */

  const frame = (now) => {
    raf = 0;
    if (disposed || !program) return;
    if (!visible || document.hidden) {
      running = false;
      return;
    }
    if (minStep && now - lastFrame < minStep) {
      raf = requestAnimationFrame(frame);
      return;
    }
    lastFrame = now;
    draw((now - startedAt) * 0.001);
    raf = requestAnimationFrame(frame);
  };

  const start = () => {
    if (disposed || raf || !visible || document.hidden || reduced) return;
    running = true;
    raf = requestAnimationFrame(frame);
  };

  const stopLoop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    running = false;
  };

  /* ---------------------------------------------------------- observers */

  const onVisibility = () => {
    if (document.hidden) stopLoop();
    else start();
  };

  const onContextLost = (event) => {
    event.preventDefault();
    stopLoop();
    program = null;
    buffer = null;
    locations.clear();
  };

  const onContextRestored = () => {
    if (disposed) return;
    startedAt = performance.now();
    if (build()) start();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);

  const intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) start();
      else stopLoop();
    },
    { rootMargin: '10% 0px' },
  );
  intersectionObserver.observe(host);

  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  canvas.addEventListener('webglcontextrestored', onContextRestored, false);
  motionQuery.addEventListener('change', onMotionChange);

  /* -------------------------------------------------------------- boot */

  if (build()) {
    if (reduced) draw(0);
    else start();
  }

  return {
    canvas,
    start,
    pause: stopLoop,
    resume: start,
    /** Force a single frame — useful after a palette change. */
    renderOnce() {
      startedAt = performance.now();
      draw(0);
    },
    /** Re-read token colours without rebuilding the program. */
    refreshColors() {
      for (const [name, token] of Object.entries(autoColors)) {
        values.set(name, { type: '3f', value: colorFromToken(token, [1, 1, 1]) });
      }
      if (reduced) draw(0);
    },
    destroy() {
      disposed = true;
      stopLoop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      motionQuery.removeEventListener('change', onMotionChange);

      if (gl && program) {
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
      }

      canvas.remove();
      program = null;
      buffer = null;
      locations.clear();
      values.clear();
    },
  };
}

/**
 * Lazy mount: only creates the context when the host scrolls into view.
 * Use this for anything below the fold, and for anything above it if the hero
 * text must paint first.
 *
 *   const handle = lazyShader(host, { fragment, autoColors: {...} });
 *   handle.destroy();
 */
export function lazyShader(host, options = {}) {
  if (!host) return { destroy() {} };

  let api = null;
  let destroyed = false;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || api || destroyed) continue;
        observer.disconnect();
        api = createShaderCanvas(host, options);
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
