// Shared helpers: seeded random, toon materials, merging coloured primitives into one geometry.
import * as THREE from '../vendor/three.module.min.js';

export function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

let grad = null;
export function gradientMap() {
  if (grad) return grad;
  grad = new THREE.DataTexture(new Uint8Array([90, 170, 235, 255]), 4, 1, THREE.RedFormat);
  grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true; return grad;
}
export const toon = (o = {}) => new THREE.MeshToonMaterial({ gradientMap: gradientMap(), ...o });

// parts: [geometry, colorHex, matrix?]. Returns one non-indexed geometry with vertex colours (one draw call).
export function mergeColored(parts) {
  const pos = [], nor = [], col = []; const c = new THREE.Color(), nm = new THREE.Matrix3();
  for (const [g0, hex, m] of parts) {
    let g = g0.index ? g0.toNonIndexed() : g0.clone(); if (m) g.applyMatrix4(m);
    c.set(hex); const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    for (let i = 0; i < p.length / 3; i++) col.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeBoundingSphere(); return g;
}
export const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const rand = (a, b) => a + Math.random() * (b - a);
