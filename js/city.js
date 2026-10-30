// The cartoon city: buildings made of chunks (glass / brick / concrete), destruction, collapse, and fires.
import * as THREE from '../vendor/three.module.min.js';
import { rng, toon, mergeColored, M, rand } from './util.js';

export const CELL = 4, FLOOR = 4, NB = 5, BLOCK = 44, STREET = 16, PITCH = 60, WORLD = NB * PITCH + STREET, HALF = WORLD / 2;
export const GLASS = 0, BRICK = 1, CONCRETE = 2;
export const MATS = [{ name: 'glass', hp: 1, pts: 10 }, { name: 'brick', hp: 3, pts: 25 }, { name: 'concrete', hp: 5, pts: 50 }];
export const streetLine = k => -HALF + k * PITCH + STREET / 2;
const PAL = {
  [BRICK]: ['#d9603b', '#c9483a', '#e07b39', '#b8563f', '#e3a03f', '#d46a6a', '#a8553a'],
  [CONCRETE]: ['#f2e6c9', '#bfe3d0', '#f5c6d6', '#c7dcf2', '#f6f0a8', '#e8d5f2', '#ffffff', '#ffd9a8'],
  [GLASS]: ['#7fd3ff', '#8fe8e0', '#9db8ff', '#7ff0c0', '#b0c8ff'],
};

function faceTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128);
  const pane = (px, py, w, h) => {
    x.fillStyle = 'rgba(255,255,255,1)'; x.fillRect(px - 6, py - 6, w + 12, h + 12); // frame
    const g = x.createLinearGradient(px, py, px + w, py + h); g.addColorStop(0, 'rgba(170,220,255,0.5)'); g.addColorStop(1, 'rgba(60,110,190,0.5)');
    x.clearRect(px, py, w, h); x.fillStyle = g; x.fillRect(px, py, w, h);
    x.fillStyle = 'rgba(235,248,255,0.5)'; x.beginPath(); x.moveTo(px + w * 0.15, py + h); x.lineTo(px + w * 0.45, py); x.lineTo(px + w * 0.6, py); x.lineTo(px + w * 0.3, py + h); x.fill();
    x.fillStyle = 'rgba(255,255,255,1)'; x.fillRect(px + w / 2 - 2, py, 4, h);
  };
  if (kind === BRICK) {
    x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 2;
    for (let y = 8; y < 128; y += 12) { x.beginPath(); x.moveTo(0, y); x.lineTo(128, y); x.stroke(); for (let i = (y / 12 % 2) * 12; i < 128; i += 24) { x.beginPath(); x.moveTo(i, y); x.lineTo(i, y + 12); x.stroke(); } }
    pane(36, 30, 56, 64); x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(26, 100, 76, 8);
  } else if (kind === CONCRETE) {
    x.fillStyle = 'rgba(0,0,0,0.10)'; x.fillRect(0, 118, 128, 10); x.fillRect(0, 0, 128, 4);
    pane(20, 28, 88, 70);
  } else {
    const g = x.createLinearGradient(0, 0, 128, 128); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#cfe6f5'); g.addColorStop(1, '#8fb5d6');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    x.fillStyle = 'rgba(255,255,255,0.7)'; x.beginPath(); x.moveTo(20, 128); x.lineTo(70, 0); x.lineTo(92, 0); x.lineTo(42, 128); x.fill();
    x.fillStyle = '#5d6f80'; x.fillRect(0, 0, 128, 7); x.fillRect(0, 121, 128, 7); x.fillRect(0, 0, 7, 128); x.fillRect(121, 0, 7, 128); x.fillRect(62, 0, 4, 128);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function damageable(mat) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aDmg; varying float vDmg;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDmg = aDmg;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vDmg;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float win = step(sampledDiffuseColor.a, 0.75);
        vec3 wc = vDmg > 0.0 ? vec3(0.05, 0.05, 0.07) : sampledDiffuseColor.rgb;
        diffuseColor.rgb = mix(diffuseColor.rgb, wc, win);
        vec2 u = vMapUv;
        float c1 = abs(fract(u.x * 1.3 + u.y * 2.1 + 0.37) - 0.5), c2 = abs(fract(u.x * -2.2 + u.y * 1.4 + 0.71) - 0.5), c3 = abs(fract(u.x * 3.1 - u.y * 0.7 + 0.2) - 0.5);
        float crack = (1.0 - smoothstep(0.0, 0.02, c1)) * step(0.2, vDmg) + (1.0 - smoothstep(0.0, 0.02, c2)) * step(0.45, vDmg) + (1.0 - smoothstep(0.0, 0.02, c3)) * step(0.7, vDmg);
        diffuseColor.rgb *= (1.0 - 0.4 * vDmg) * (1.0 - 0.75 * min(crack, 1.0));
        diffuseColor.a = 1.0;
      }`);
  };
  return mat;
}

function groundTexture(parks, lots) {
  const S = 2048, k = S / WORLD, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  const W = v => (v + HALF) * k;
  x.fillStyle = '#4a4f5a'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
    const bx = W(-HALF + i * PITCH + STREET), bz = W(-HALF + j * PITCH + STREET), bw = BLOCK * k;
    x.fillStyle = '#cfcabd'; x.fillRect(bx, bz, bw, bw);
    x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 1; for (let t = 0; t < bw; t += 3 * k) { x.beginPath(); x.moveTo(bx + t, bz); x.lineTo(bx + t, bz + bw); x.stroke(); x.beginPath(); x.moveTo(bx, bz + t); x.lineTo(bx + bw, bz + t); x.stroke(); }
    x.fillStyle = '#9fd36a'; x.fillRect(bx + 3 * k, bz + 3 * k, bw - 6 * k, bw - 6 * k);
  }
  for (const p of parks) {
    const bx = W(p.x0), bz = W(p.z0), bw = BLOCK * k;
    x.fillStyle = '#7ccf5a'; x.fillRect(bx + 3 * k, bz + 3 * k, bw - 6 * k, bw - 6 * k);
    x.strokeStyle = '#e8d9a8'; x.lineWidth = 3 * k; x.beginPath(); x.moveTo(bx + 3 * k, bz + bw / 2); x.lineTo(bx + bw - 3 * k, bz + bw / 2); x.moveTo(bx + bw / 2, bz + 3 * k); x.lineTo(bx + bw / 2, bz + bw - 3 * k); x.stroke();
    x.fillStyle = '#5fb6f0'; x.beginPath(); x.ellipse(bx + bw * 0.27, bz + bw * 0.73, 6 * k, 4.5 * k, 0, 0, 7); x.fill();
  }
  for (const l of lots) { x.fillStyle = l.c; x.fillRect(W(l.x0) - k, W(l.z0) - k, l.w * k + 2 * k, l.d * k + 2 * k); }
  for (let s = 0; s <= NB; s++) {
    const m = W(streetLine(s));
    x.strokeStyle = '#ffd23f'; x.lineWidth = 0.5 * k; x.setLineDash([3 * k, 3 * k]);
    x.beginPath(); x.moveTo(m, 0); x.lineTo(m, S); x.moveTo(0, m); x.lineTo(S, m); x.stroke(); x.setLineDash([]);
    for (let t = 0; t <= NB; t++) { // crossings
      const n = W(streetLine(t)); x.fillStyle = '#4a4f5a'; x.fillRect(m - 8 * k, n - 8 * k, 16 * k, 16 * k);
      x.fillStyle = 'rgba(255,255,255,0.85)';
      for (let q = -6; q <= 6; q += 2) { x.fillRect(m + q * k - 0.5 * k, n - 8 * k - 3 * k, k, 2.6 * k); x.fillRect(m + q * k - 0.5 * k, n + 8 * k + 0.4 * k, k, 2.6 * k); x.fillRect(m - 8 * k - 3 * k, n + q * k - 0.5 * k, 2.6 * k, k); x.fillRect(m + 8 * k + 0.4 * k, n + q * k - 0.5 * k, 2.6 * k, k); }
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export class City {
  constructor(G) {
    this.G = G; const scene = G.scene; this.fires = []; this.ruins = []; this.fireTimer = 12; this.destroyed = 0;
    const R = rng(20261030); this.R = R; const specs = [], lots = []; this.parks = []; const treeSpots = [];
    for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
      const bx0 = -HALF + i * PITCH + STREET, bz0 = -HALF + j * PITCH + STREET;
      for (let t = 4; t < BLOCK; t += 9) { treeSpots.push([bx0 + t, bz0 + 1.3], [bx0 + t, bz0 + BLOCK - 1.3], [bx0 + 1.3, bz0 + t], [bx0 + BLOCK - 1.3, bz0 + t]); }
      if (i === 2 && j === 2) { this.parks.push({ x0: bx0, z0: bz0 }); for (let n = 0; n < 7; n++) treeSpots.push([bx0 + 6 + R() * 32, bz0 + 6 + R() * 10]); for (let n = 0; n < 5; n++) treeSpots.push([bx0 + 26 + R() * 13, bz0 + 26 + R() * 13]); continue; }
      const d = Math.max(Math.abs(i - 2), Math.abs(j - 2));
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
        const lx = bx0 + 3 + a * 19, lz = bz0 + 3 + b * 19, r = R(); let kind;
        if (d === 1) kind = r < 0.5 ? 'sky' : r < 0.85 ? 'office' : 'small'; else kind = r < 0.12 ? 'sky' : r < 0.42 ? 'office' : r < 0.9 ? 'small' : 'empty';
        let nx, nz, ny;
        if (kind === 'sky') { nx = R() < 0.5 ? 4 : 3; nz = 4; ny = 12 + Math.floor(R() * 9); }
        else if (kind === 'office') { nx = 3; nz = R() < 0.4 ? 4 : 3; ny = 6 + Math.floor(R() * 6); }
        else if (kind === 'small') { nx = 2 + (R() < 0.4 ? 1 : 0); nz = 2 + (R() < 0.4 ? 1 : 0); ny = 2 + Math.floor(R() * 4); }
        else { for (let n = 0; n < 3; n++) treeSpots.push([lx + 3 + R() * 13, lz + 3 + R() * 13]); continue; }
        const x0 = lx + (19 - nx * CELL) / 2, z0 = lz + (19 - nz * CELL) / 2;
        specs.push({ kind, nx, ny, nz, x0, z0 });
        lots.push({ x0, z0, w: nx * CELL, d: nz * CELL, c: kind === 'sky' ? '#b9c3cc' : kind === 'office' ? '#d8d2c4' : '#c9b79a' });
      }
    }
    // chunks
    const cb = [], cx = [], cy = [], cz = [], cm = [], ccol = []; this.buildings = [];
    const col = new THREE.Color();
    specs.forEach((s, bi) => {
      const mat0 = s.kind === 'sky' ? GLASS : s.kind === 'office' ? CONCRETE : (R() < 0.75 ? BRICK : CONCRETE);
      const base = new THREE.Color(PAL[mat0][Math.floor(R() * PAL[mat0].length)]);
      const frame = new THREE.Color(PAL[CONCRETE][Math.floor(R() * PAL[CONCRETE].length)]);
      const b = { id: bi, kind: s.kind, nx: s.nx, ny: s.ny, nz: s.nz, x0: s.x0, z0: s.z0, x1: s.x0 + s.nx * CELL, z1: s.z0 + s.nz * CELL, h: s.ny * FLOOR,
        cells: new Int32Array(s.nx * s.ny * s.nz).fill(-1), ids: [], alive: 0, total: 0, base: 0, baseAlive: 0, sink: 0, vs: 0, collapsing: false, dead: false, dirty: false, fireN: 0, near: [] };
      b.cx = (b.x0 + b.x1) / 2; b.cz = (b.z0 + b.z1) / 2;
      for (let iy = 0; iy < s.ny; iy++) for (let iz = 0; iz < s.nz; iz++) for (let ix = 0; ix < s.nx; ix++) {
        const shell = ix === 0 || iz === 0 || ix === s.nx - 1 || iz === s.nz - 1 || iy === s.ny - 1; if (!shell) continue;
        let m = mat0, c = base;
        if (s.kind === 'sky') { const corner = (ix === 0 || ix === s.nx - 1) && (iz === 0 || iz === s.nz - 1); if (corner || iy % 5 === 0 || iy === s.ny - 1) { m = CONCRETE; c = frame; } }
        const id = cb.length; b.cells[(iy * s.nz + iz) * s.nx + ix] = id; b.ids.push(id);
        cb.push(bi); cx.push(ix); cy.push(iy); cz.push(iz); cm.push(m);
        const v = 0.93 + R() * 0.12; ccol.push(c.r * v, c.g * v, c.b * v);
        b.total++; if (iy <= 1) b.base++;
      }
      b.alive = b.total; b.baseAlive = b.base; this.buildings.push(b);
    });
    for (const a of this.buildings) for (const b of this.buildings) if (a !== b) { const gx = Math.max(a.x0 - b.x1, b.x0 - a.x1), gz = Math.max(a.z0 - b.z1, b.z0 - a.z1); if (Math.max(gx, gz) < 14) a.near.push(b); }
    const N = cb.length; this.N = N;
    this.cb = Int32Array.from(cb); this.cx = Int8Array.from(cx); this.cy = Int8Array.from(cy); this.cz = Int8Array.from(cz); this.cm = Int8Array.from(cm);
    this.hp = new Float32Array(N); this.alive = new Uint8Array(N).fill(1); this.inst = new Int32Array(N); this.burning = new Uint8Array(N);
    this.wx = new Float32Array(N); this.wy = new Float32Array(N); this.wz = new Float32Array(N); this.col = Float32Array.from(ccol);
    const counts = [0, 0, 0]; for (let i = 0; i < N; i++) { this.inst[i] = counts[this.cm[i]]++; this.hp[i] = MATS[this.cm[i]].hp; const b = this.buildings[this.cb[i]]; this.wx[i] = b.x0 + (this.cx[i] + 0.5) * CELL; this.wy[i] = (this.cy[i] + 0.5) * FLOOR; this.wz[i] = b.z0 + (this.cz[i] + 0.5) * CELL; }
    this.meshes = []; this.dmgAttr = []; const d = new THREE.Object3D();
    for (let m = 0; m < 3; m++) {
      const geo = new THREE.BoxGeometry(CELL * 0.985, FLOOR * 0.985, CELL * 0.985); const da = new THREE.InstancedBufferAttribute(new Float32Array(counts[m]), 1); geo.setAttribute('aDmg', da);
      const side = damageable(toon({ map: faceTexture(m) })), top = toon({ color: m === GLASS ? 0xcfd8e0 : 0xd8d0c4 });
      const mesh = new THREE.InstancedMesh(geo, [side, side, top, top, side, side], Math.max(1, counts[m]));
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, counts[m]) * 3), 3);
      mesh.frustumCulled = false; scene.add(mesh); this.meshes.push(mesh); this.dmgAttr.push(da);
    }
    for (let i = 0; i < N; i++) {
      const mesh = this.meshes[this.cm[i]], k = this.inst[i];
      d.position.set(this.wx[i], this.wy[i], this.wz[i]); d.updateMatrix(); mesh.setMatrixAt(k, d.matrix);
      mesh.instanceColor.setXYZ(k, this.col[3 * i], this.col[3 * i + 1], this.col[3 * i + 2]);
    }
    this.d = d; this.matDirty = [false, false, false];
    // ground
    const gtex = groundTexture(this.parks, lots);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD), toon({ map: gtex })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const outer = new THREE.Mesh(new THREE.RingGeometry(WORLD * 0.71, WORLD * 4, 4, 1), toon({ color: 0x8acb5c })); outer.rotation.x = -Math.PI / 2; outer.rotation.z = Math.PI / 4; outer.position.y = -0.05; scene.add(outer);
    // trees
    const trunkG = new THREE.CylinderGeometry(0.35, 0.5, 2.6, 7); trunkG.translate(0, 1.3, 0);
    const leafG = new THREE.IcosahedronGeometry(2.1, 1); leafG.translate(0, 3.9, 0);
    this.trees = treeSpots;
    const tr = new THREE.InstancedMesh(trunkG, toon({ color: 0x8a5a33 }), treeSpots.length), lf = new THREE.InstancedMesh(leafG, toon({ color: 0xffffff }), treeSpots.length);
    treeSpots.forEach(([x, z], i) => { const s = 0.8 + R() * 0.5; d.position.set(x, 0, z); d.scale.set(s, s, s); d.rotation.set(0, R() * 6, 0); d.updateMatrix(); tr.setMatrixAt(i, d.matrix); lf.setMatrixAt(i, d.matrix); col.setHSL(0.25 + R() * 0.1, 0.6, 0.38 + R() * 0.12); lf.setColorAt(i, col); });
    d.scale.set(1, 1, 1); d.rotation.set(0, 0, 0); scene.add(tr, lf);
    // street lamps at block corners
    const lampG = mergeColored([[new THREE.CylinderGeometry(0.15, 0.2, 7, 6), '#5b6270', M(0, 3.5, 0)], [new THREE.BoxGeometry(1.6, 0.25, 0.4), '#5b6270', M(0.7, 7, 0)], [new THREE.SphereGeometry(0.35, 8, 6), '#fff6b0', M(1.4, 6.8, 0)]]);
    const lamps = []; for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) { const bx0 = -HALF + i * PITCH + STREET, bz0 = -HALF + j * PITCH + STREET; lamps.push([bx0 + 1, bz0 + 1, Math.PI * 1.25], [bx0 + BLOCK - 1, bz0 + BLOCK - 1, Math.PI * 0.25], [bx0 + 1, bz0 + BLOCK - 1, Math.PI * 1.75], [bx0 + BLOCK - 1, bz0 + 1, Math.PI * 0.75]); }
    const lm = new THREE.InstancedMesh(lampG, toon({ vertexColors: true }), lamps.length);
    lamps.forEach(([x, z, r], i) => { d.position.set(x, 0, z); d.rotation.set(0, -r + Math.PI / 2, 0); d.updateMatrix(); lm.setMatrixAt(i, d.matrix); }); d.rotation.set(0, 0, 0); scene.add(lm);
    // clouds
    const cg = mergeColored([[new THREE.IcosahedronGeometry(8, 1), '#fff'], [new THREE.IcosahedronGeometry(6, 1), '#fff', M(8, -1, 2)], [new THREE.IcosahedronGeometry(6, 1), '#fff', M(-8, -1, -1)], [new THREE.IcosahedronGeometry(5, 1), '#fff', M(3, 4, 0)]]);
    const cm2 = toon({ vertexColors: true, emissive: 0x99aabb }); this.clouds = [];
    for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(cg, cm2); c.position.set(rand(-HALF, HALF) * 1.4, rand(120, 170), rand(-HALF, HALF) * 1.4); c.scale.setScalar(rand(1, 1.8)); scene.add(c); this.clouds.push(c); }
    this.rubbleGeo = mergeColored(Array.from({ length: 9 }, (_, i) => [new THREE.BoxGeometry(0.35 + R() * 0.3, 0.5 + R() * 0.5, 0.35 + R() * 0.3), ['#8a8580', '#a59e94', '#6e6a66'][i % 3], M(R() - 0.5, 0, R() - 0.5, R(), R(), R())]));
    this.rubbleGeo.translate(0, 0.15, 0);
  }

  top(b) { return b.h - b.sink; }
  setMatrix(i, dy = 0, jx = 0, jz = 0) { const d = this.d, m = this.cm[i]; d.position.set(this.wx[i] + jx, this.wy[i] + dy, this.wz[i] + jz); d.scale.set(1, 1, 1); d.updateMatrix(); this.meshes[m].setMatrixAt(this.inst[i], d.matrix); this.matDirty[m] = true; }
  hide(i) { const d = this.d, m = this.cm[i]; d.position.set(0, -50, 0); d.scale.set(0, 0, 0); d.updateMatrix(); this.meshes[m].setMatrixAt(this.inst[i], d.matrix); this.matDirty[m] = true; d.scale.set(1, 1, 1); }
  setDmg(i) { const m = this.cm[i], v = 1 - Math.max(0, this.hp[i]) / MATS[m].hp; this.dmgAttr[m].setX(this.inst[i], Math.max(0.01, v)); this.dmgAttr[m].needsUpdate = true; }
  colorHex(i) { return new THREE.Color(this.col[3 * i], this.col[3 * i + 1], this.col[3 * i + 2]).getHex(); }
  normalOf(i) { const b = this.buildings[this.cb[i]], x = this.cx[i], z = this.cz[i]; if (x === 0) return [-1, 0, 0]; if (x === b.nx - 1) return [1, 0, 0]; if (z === 0) return [0, 0, -1]; if (z === b.nz - 1) return [0, 0, 1]; return [0, 1, 0]; }
  cellId(b, x, y, z) { if (x < 0 || y < 0 || z < 0 || x >= b.nx || y >= b.ny || z >= b.nz) return -1; return b.cells[(y * b.nz + z) * b.nx + x]; }
  neighbours(i) { const b = this.buildings[this.cb[i]], x = this.cx[i], y = this.cy[i], z = this.cz[i], r = []; for (const [a, c, e] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const n = this.cellId(b, x + a, y + c, z + e); if (n >= 0 && this.alive[n]) r.push(n); } return r; }

  // Chunks within r of point p (live buildings only), nearest first.
  chunksNear(p, r) {
    const out = [];
    for (const b of this.buildings) {
      if (b.dead || b.collapsing) continue;
      if (p.x < b.x0 - r || p.x > b.x1 + r || p.z < b.z0 - r || p.z > b.z1 + r || p.y > b.h + r) continue;
      for (const i of b.ids) { if (!this.alive[i]) continue; const dx = this.wx[i] - p.x, dy = this.wy[i] - p.y, dz = this.wz[i] - p.z, dd = dx * dx + dy * dy + dz * dz; if (dd < r * r) out.push([i, Math.sqrt(dd)]); }
    }
    return out.sort((a, b) => a[1] - b[1]);
  }
  damageSphere(p, r, dmg, dir, maxN = 99, cause = 'punch') {
    const list = this.chunksNear(p, r); let hit = 0, broken = 0;
    for (const [i, dist] of list.slice(0, maxN)) { hit++; if (this.damageChunk(i, dmg * (maxN <= 3 ? 1 : 1 - 0.5 * dist / r), dir, cause)) broken++; }
    return { hit, broken };
  }
  damageChunk(i, amt, dir, cause) {
    if (!this.alive[i]) return false; const m = this.cm[i], first = this.hp[i] >= MATS[m].hp;
    this.hp[i] -= amt; const G = this.G;
    if (this.hp[i] <= 0) { this.breakChunk(i, dir, cause); return true; }
    if (first && m !== GLASS) { this.shards(i, 6); G.sfx.play('glass'); }
    this.setDmg(i); G.smallDust(this.wx[i], this.wy[i], this.wz[i]);
    return false;
  }
  shards(i, n) {
    const [nx, , nz] = this.normalOf(i), G = this.G;
    for (let k = 0; k < n; k++) G.shards.spawn(this.wx[i] + nx * 2.1 + rand(-1.5, 1.5), this.wy[i] + rand(-1.2, 1.2), this.wz[i] + nz * 2.1 + rand(-1.5, 1.5), nx * rand(3, 9) + rand(-3, 3), rand(0, 6), nz * rand(3, 9) + rand(-3, 3), rand(0.3, 0.7), 0.08, rand(0.3, 0.6), 0xbfe8ff, rand(1.2, 2.2));
  }
  breakChunk(i, dir, cause = 'punch', quiet = false) {
    if (!this.alive[i]) return; const G = this.G, m = this.cm[i], b = this.buildings[this.cb[i]];
    this.alive[i] = 0; this.hp[i] = 0; this.hide(i); b.alive--; if (this.cy[i] <= 1) b.baseAlive--; b.dirty = true; this.destroyed++;
    const [nx, , nz] = this.normalOf(i), dx = dir ? dir.x : nx, dz = dir ? dir.z : nz;
    if (!quiet) {
      if (m === GLASS) { this.shards(i, 14); G.sfx.play('glass'); }
      else {
        this.shards(i, 5); const c = this.colorHex(i);
        for (let k = 0; k < 3; k++) { const s = rand(1.1, 2.0); G.debris.spawn(this.wx[i] + rand(-1, 1), this.wy[i] + rand(-1, 1), this.wz[i] + rand(-1, 1), dx * rand(4, 12) + rand(-3, 3), rand(2, 9), dz * rand(4, 12) + rand(-3, 3), s, s * rand(0.6, 1), s, c, rand(2.5, 4)); }
        G.sfx.play('crumble');
      }
      G.dust(this.wx[i], this.wy[i], this.wz[i], m === GLASS ? 1 : 3);
    }
    G.onChunk(m, new THREE.Vector3(this.wx[i], this.wy[i], this.wz[i]), cause);
  }

  // building physics after damage: unsupported chunks fall, too much damage = collapse
  checkBuilding(b) {
    b.dirty = false; if (b.dead || b.collapsing) return;
    if (b.alive / b.total < 0.5 || b.baseAlive / b.base < 0.5) return this.collapse(b);
    const seen = new Uint8Array(b.ids.length), idx = new Map(b.ids.map((id, k) => [id, k])), q = [];
    for (const i of b.ids) if (this.alive[i] && this.cy[i] === 0) { seen[idx.get(i)] = 1; q.push(i); }
    while (q.length) { const i = q.pop(); for (const n of this.neighbours(i)) { const k = idx.get(n); if (!seen[k]) { seen[k] = 1; q.push(n); } } }
    const loose = b.ids.filter((i, k) => this.alive[i] && !seen[k]);
    if (!loose.length) return;
    if (loose.length > b.alive * 0.3) return this.collapse(b);
    for (const i of loose) {
      const c = this.colorHex(i); if (this.G.debris.live < this.G.debris.limit - 10) this.G.debris.spawn(this.wx[i], this.wy[i], this.wz[i], rand(-2, 2), 0, rand(-2, 2), 3.6, 3.6, 3.6, c, rand(3, 4.5));
      this.breakChunk(i, null, 'fall', true);
    }
    this.G.dust(b.cx, 2, b.cz, 6); this.G.sfx.play('crumble');
    if (b.alive / b.total < 0.5 || b.baseAlive / b.base < 0.5) this.collapse(b);
  }
  collapse(b) {
    if (b.collapsing || b.dead) return; b.collapsing = true; b.vs = 1.5; b.t = 0;
    this.fires = this.fires.filter(f => { if (this.cb[f.id] === b.id) { this.burning[f.id] = 0; return false; } return true; }); b.fireN = 0;
    this.G.onCollapse(b); this.G.sfx.play('rumble'); this.G.shake(0.8);
  }
  finishCollapse(b) {
    let n = 0; for (const i of b.ids) if (this.alive[i]) { this.alive[i] = 0; this.hide(i); n++; }
    this.destroyed += n; b.alive = 0; b.dead = true; b.collapsing = false; this.G.onChunksGone(n);
    const r = new THREE.Mesh(this.rubbleGeo, toon({ vertexColors: true, color: new THREE.Color(this.col[3 * b.ids[0]], this.col[3 * b.ids[0] + 1], this.col[3 * b.ids[0] + 2]).lerp(new THREE.Color(0x999999), 0.5) }));
    r.position.set(b.cx, 0, b.cz); r.scale.set(b.x1 - b.x0, Math.min(5, 1.5 + b.h * 0.06), b.z1 - b.z0); this.G.scene.add(r);
    this.ruins.push({ x: b.cx, z: b.cz, w: b.x1 - b.x0, t: 30, acc: 0 });
  }

  startFire(i) {
    if (i < 0 || !this.alive[i] || this.burning[i] || this.fires.length >= this.G.maxFires) return false;
    const b = this.buildings[this.cb[i]]; if (b.collapsing || b.dead) return false;
    this.burning[i] = 1; b.fireN++; this.fires.push({ id: i, spread: rand(4, 8), fa: 0, sa: 0, n: this.normalOf(i) }); return true;
  }
  igniteBuilding(b, near) {
    if (!b || b.dead || b.collapsing) return false;
    let best = -1, bd = 1e9;
    for (let t = 0; t < 12; t++) { const i = b.ids[Math.floor(Math.random() * b.ids.length)]; if (!this.alive[i] || this.burning[i]) continue; const d = near ? Math.hypot(this.wx[i] - near.x, this.wy[i] - near.y, this.wz[i] - near.z) : (this.hp[i] < MATS[this.cm[i]].hp ? 0 : 1) + Math.random(); if (d < bd) { bd = d; best = i; } }
    return this.startFire(best);
  }
  buildingAt(x, y, z, pad = 0) { for (const b of this.buildings) { if (b.dead) continue; if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad && y < this.top(b) + pad) return b; } return null; }

  update(dt) {
    const G = this.G;
    for (const b of this.buildings) if (b.dirty) this.checkBuilding(b);
    // collapsing buildings sink into a dust cloud
    for (const b of this.buildings) {
      if (!b.collapsing) continue; b.t += dt; b.vs = Math.min(b.vs + 7 * dt, 9); b.sink += b.vs * dt;
      for (const i of b.ids) if (this.alive[i]) { const w = Math.sin(b.t * 23 + i) * 0.35, h = this.wy[i] / b.h; this.setMatrix(i, -b.sink, w + Math.sin(b.t * 1.7) * h * 1.2, Math.cos(b.t * 19 + i) * 0.35); }
      const n = Math.ceil(G.lowGfx ? 1 : 3);
      for (let k = 0; k < n; k++) { const side = Math.random() < 0.5, u = Math.random(); const x = side ? (Math.random() < 0.5 ? b.x0 - 1 : b.x1 + 1) : b.x0 + u * (b.x1 - b.x0), z = side ? b.z0 + u * (b.z1 - b.z0) : (Math.random() < 0.5 ? b.z0 - 1 : b.z1 + 1);
        G.smoke.emit(x, rand(0, 5), z, (x - b.cx) * 0.6, rand(1, 4), (z - b.cz) * 0.6, rand(2.5, 4), 5, 16, 0.78, 0.72, 0.63, 0.85, 0.5, 0.8); }
      if (b.sink > b.h + 1) this.finishCollapse(b);
    }
    for (let m = 0; m < 3; m++) if (this.matDirty[m]) { this.meshes[m].instanceMatrix.needsUpdate = true; this.matDirty[m] = false; }
    // fires
    const hi = !G.lowGfx;
    for (let k = this.fires.length - 1; k >= 0; k--) {
      const f = this.fires[k], i = f.id, b = this.buildings[this.cb[i]];
      if (!this.alive[i] || b.collapsing || b.dead) { this.burning[i] = 0; b.fireN--; this.fires.splice(k, 1); continue; }
      const [nx, ny, nz] = f.n, px = this.wx[i] + nx * 2.2, py = this.wy[i] + ny * 2.2, pz = this.wz[i] + nz * 2.2;
      f.fa += dt * (hi ? 26 : 11); while (f.fa > 1) { f.fa--; const yel = Math.random() < 0.45; G.fire.emit(px + rand(-1.6, 1.6), py + rand(-1.6, 0.5), pz + rand(-1.6, 1.6), rand(-1, 1) + nx * 1.5, rand(4, 8), rand(-1, 1) + nz * 1.5, rand(0.5, 0.95), rand(2.6, 3.8), 0.6, 1, yel ? 0.85 : 0.45, yel ? 0.3 : 0.08, 0.95, 3); }
      f.sa += dt * (hi ? 4.5 : 2.2); while (f.sa > 1) { f.sa--; const g = rand(0.18, 0.32); G.smoke.emit(px + rand(-1, 1), py + 2, pz + rand(-1, 1), 1.6 + rand(-1, 1) + nx, rand(5, 7), 0.6 + rand(-1, 1) + nz, rand(5, 8), 3, 14, g, g, g * 1.05, 0.6, 0.6, 0.15); }
      this.hp[i] -= dt * 0.22; this.setDmg(i);
      if (this.hp[i] <= 0) {
        const nb = this.neighbours(i); this.burning[i] = 0; b.fireN--; this.fires.splice(k, 1); this.breakChunk(i, null, 'fire');
        if (nb.length) this.startFire(nb[Math.floor(Math.random() * nb.length)]); continue;
      }
      f.spread -= dt;
      if (f.spread <= 0) {
        f.spread = rand(5, 9); const nb = this.neighbours(i).filter(n => !this.burning[n]);
        if (nb.length) { nb.sort((a, c) => this.cy[c] - this.cy[a] + Math.random() - 0.5); this.startFire(nb[0]); }
        if (Math.random() < 0.15 && b.near.length) this.igniteBuilding(b.near[Math.floor(Math.random() * b.near.length)], { x: px, y: py, z: pz });
      }
    }
    // random new fires, more likely on damaged buildings
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = rand(6, 13) * (1 - 0.4 * G.destroyedFrac());
      let tot = 0; const live = this.buildings.filter(b => !b.dead && !b.collapsing); const w = live.map(b => { const v = 1 + 8 * (1 - b.alive / b.total); tot += v; return v; });
      let r = Math.random() * tot; for (let k = 0; k < live.length; k++) { r -= w[k]; if (r <= 0) { this.igniteBuilding(live[k]); break; } }
    }
    for (let k = this.ruins.length - 1; k >= 0; k--) { const r = this.ruins[k]; r.t -= dt; if (r.t <= 0) { this.ruins.splice(k, 1); continue; } r.acc += dt * (hi ? 3 : 1.2) * Math.min(1, r.t / 10); while (r.acc > 1) { r.acc--; const g = rand(0.3, 0.45); G.smoke.emit(r.x + rand(-r.w / 2, r.w / 2), 2, r.z + rand(-r.w / 2, r.w / 2), 1.5, rand(3, 5), 0.5, rand(5, 7), 4, 13, g, g, g, 0.5, 0.4, 0.15); } }
  }
}
