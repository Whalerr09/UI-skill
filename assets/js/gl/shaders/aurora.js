/**
 * aurora.js — a domain-warped fBm light field.
 *
 * Reads as slow volumetric light rather than "a shader": five octaves of value
 * noise warped twice, banded vertically into curtains, then graded with a
 * vignette, film grain, and dithering so dark ramps never band.
 *
 * Colours come from CSS tokens, so the effect follows the palette:
 *   const field = mountAurora(host);          // default: --accent / --ink-3
 *
 * Cycle time is ~40s. If you can see it move while staring at one pixel, you
 * turned uSpeed up too far.
 */

import { lazyShader, createShaderCanvas, colorFromToken } from '../ShaderCanvas.js';

export const AURORA_FRAGMENT = /* glsl */ `
precision highp float;

uniform vec2  uRes;
uniform float uT;
uniform vec3  uColA;
uniform vec3  uColB;
uniform float uSpeed;
uniform float uGlow;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * valueNoise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  /* Normalise by the shorter axis so the field never stretches. */
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);

  float t = uT * 0.055 * max(uSpeed, 0.0);
  vec2 p = uv * 1.28;

  /* Two rounds of domain warping: this is what makes it read as fluid. */
  vec2 q = vec2(
    fbm(p + vec2(0.0, t)),
    fbm(p + vec2(5.2, 1.3) - t * 0.7)
  );

  vec2 r = vec2(
    fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.6),
    fbm(p + 4.0 * q + vec2(8.3, 2.8) - t * 0.4)
  );

  float f = fbm(p + 4.0 * r);

  /* Vertical curtains: a wandering sine banded into the noise field. */
  float curtain = sin(uv.x * 2.1 + r.x * 3.0 + t * 1.6) * 0.5 + 0.5;
  float band = smoothstep(0.18, 0.96, f * 0.86 + curtain * 0.34);

  /* Concentrate the light around the middle third of the frame. */
  band *= smoothstep(1.18, 0.12, abs(uv.y + 0.12));

  float core = pow(f, 2.4);

  vec3 col = mix(uColB, uColA, band);
  col += uColA * core * 0.55 * max(uGlow, 0.0);
  col += uColB * pow(max(0.0, 1.0 - length(uv * 0.75)), 3.0) * 0.22;

  /* Vignette keeps the edges from meeting the page background as a seam. */
  col *= 1.0 - 0.45 * smoothstep(0.35, 1.35, length(uv));

  /* Grain + dither: kills 8-bit banding on slow dark ramps. */
  float grain = hash(gl_FragCoord.xy + fract(uT) * 97.0) - 0.5;
  col += grain * 0.035;
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

export const AURORA_DEFAULTS = {
  uSpeed: { type: '1f', value: 1 },
  uGlow: { type: '1f', value: 1 },
};

const AUTO_COLORS = { uColA: '--accent', uColB: '--ink-3' };

/** Mount immediately (use above the fold only if the copy paints first). */
export function createAurora(host, options = {}) {
  return createShaderCanvas(host, {
    fragment: AURORA_FRAGMENT,
    uniforms: { ...AURORA_DEFAULTS, ...(options.uniforms || {}) },
    autoColors: options.autoColors || AUTO_COLORS,
    dprCap: options.dprCap ?? 2,
    fps: options.fps ?? 60,
    onError: options.onError,
  });
}

/** Mount when the host approaches the viewport. Default choice. */
export function mountAurora(host, options = {}) {
  return lazyShader(host, {
    fragment: AURORA_FRAGMENT,
    uniforms: { ...AURORA_DEFAULTS, ...(options.uniforms || {}) },
    autoColors: options.autoColors || AUTO_COLORS,
    dprCap: options.dprCap ?? 2,
    fps: options.fps ?? 60,
    onError: options.onError,
  });
}

/** Palette-aware defaults if you want to colour it by hand. */
export function auroraColors() {
  return {
    a: colorFromToken('--accent', [0.88, 0.14, 0.11]),
    b: colorFromToken('--ink-3', [0.07, 0.1, 0.13]),
  };
}
