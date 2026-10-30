// Visual effects: point particles (fire, smoke, dust), physics debris and glass shards, tracers, score popups, sound.
import * as THREE from '../vendor/three.module.min.js';

const PV = `attribute float size; attribute float alpha; attribute vec3 pcolor; uniform float uScale;
varying float vA; varying vec3 vC;
void main(){ vA = alpha; vC = pcolor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = size > 0.0 ? clamp(size * uScale / max(-mv.z, 0.5), 1.0, 400.0) : 0.0; }`;
const PF = `varying float vA; varying vec3 vC; uniform float uSoft;
void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5 || vA <= 0.0) discard;
  float a = vA * (1.0 - smoothstep(uSoft, 0.5, d)); vec3 col = vC * (1.12 - 0.35 * gl_PointCoord.y); gl_FragColor = vec4(col, a); }`;

export class Particles {
  constructor(scene, cap, additive) {
    this.cap = cap; this.limit = cap; this.next = 0; this.live = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3);
    this.size = new Float32Array(cap); this.alpha = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap);
    this.s0 = new Float32Array(cap); this.s1 = new Float32Array(cap); this.a0 = new Float32Array(cap);
    this.buoy = new Float32Array(cap); this.drag = new Float32Array(cap);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({ vertexShader: PV, fragmentShader: PF, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uScale: { value: 400 }, uSoft: { value: additive ? 0.05 : 0.32 } } });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 3 : 2;
    scene.add(this.points); this.geo = g;
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, r, gc, b, a0 = 1, buoy = 0, drag = 0) {
    const i = this.next; this.next = (this.next + 1) % this.limit;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r; this.col[i * 3 + 1] = gc; this.col[i * 3 + 2] = b;
    this.life[i] = life; this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a0; this.buoy[i] = buoy; this.drag[i] = drag;
  }
  update(dt) {
    let live = 0;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) { if (this.size[i] !== 0) { this.size[i] = 0; this.alpha[i] = 0; } continue; }
      live++;
      const l = (this.life[i] -= dt); if (l <= 0) { this.size[i] = 0; this.alpha[i] = 0; continue; }
      const t = 1 - l / this.max[i], k = 3 * i;
      this.vel[k + 1] += this.buoy[i] * dt; const dr = 1 - Math.min(1, this.drag[i] * dt);
      this.vel[k] *= dr; this.vel[k + 1] *= dr; this.vel[k + 2] *= dr;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      this.alpha[i] = this.a0[i] * (t < 0.1 ? t * 10 : (1 - t) / 0.9);
    }
    this.live = live;
    for (const n of ['position', 'pcolor', 'size', 'alpha']) this.geo.attributes[n].needsUpdate = true;
  }
}

// Rigid little bodies drawn with one InstancedMesh: building debris and glass shards.
export class Debris {
  constructor(scene, cap, geo, mat) {
    this.cap = cap; this.limit = cap; this.next = 0; this.live = 0;
    this.mesh = new THREE.InstancedMesh(geo, mat, cap); this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    this.p = new Float32Array(cap * 3); this.v = new Float32Array(cap * 3); this.r = new Float32Array(cap * 3); this.w = new Float32Array(cap * 3);
    this.s = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.d = new THREE.Object3D(); this.c = new THREE.Color();
    const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < cap; i++) this.mesh.setMatrixAt(i, z);
    scene.add(this.mesh);
  }
  spawn(x, y, z, vx, vy, vz, sx, sy, sz, color, life) {
    const i = this.next, k = 3 * i; this.next = (this.next + 1) % this.limit;
    this.p[k] = x; this.p[k + 1] = y; this.p[k + 2] = z; this.v[k] = vx; this.v[k + 1] = vy; this.v[k + 2] = vz;
    this.r[k] = Math.random() * 6; this.r[k + 1] = Math.random() * 6; this.r[k + 2] = 0;
    this.w[k] = (Math.random() - 0.5) * 10; this.w[k + 1] = (Math.random() - 0.5) * 10; this.w[k + 2] = (Math.random() - 0.5) * 10;
    this.s[k] = sx; this.s[k + 1] = sy; this.s[k + 2] = sz; this.life[i] = life;
    this.c.set(color); this.mesh.setColorAt(i, this.c); this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt) {
    let live = 0; const d = this.d;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      const k = 3 * i; this.life[i] -= dt;
      if (this.life[i] <= 0) { d.scale.set(0, 0, 0); d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix); continue; }
      live++;
      this.v[k + 1] -= 30 * dt;
      this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
      const fl = this.s[k + 1] * 0.5;
      if (this.p[k + 1] < fl) { this.p[k + 1] = fl; this.v[k + 1] *= -0.3; this.v[k] *= 0.6; this.v[k + 2] *= 0.6; this.w[k] *= 0.5; this.w[k + 1] *= 0.5; this.w[k + 2] *= 0.5; }
      this.r[k] += this.w[k] * dt; this.r[k + 1] += this.w[k + 1] * dt; this.r[k + 2] += this.w[k + 2] * dt;
      const f = Math.min(1, this.life[i] / 0.6);
      d.position.set(this.p[k], this.p[k + 1], this.p[k + 2]); d.rotation.set(this.r[k], this.r[k + 1], this.r[k + 2]);
      d.scale.set(this.s[k] * f, this.s[k + 1] * f, this.s[k + 2] * f); d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix);
    }
    this.live = live; this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Tracers {
  constructor(scene, cap) {
    this.cap = cap; this.next = 0; this.pos = new Float32Array(cap * 6); this.t = [];
    for (let i = 0; i < cap; i++) this.t.push({ life: 0, x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0, len: 0, sp: 0 });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); this.geo = g;
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xfff27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.lines.frustumCulled = false; scene.add(this.lines); this.active = 0;
  }
  fire(from, to, speed = 160) {
    const tr = this.t[this.next]; this.next = (this.next + 1) % this.cap;
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, L = Math.hypot(dx, dy, dz) || 1;
    Object.assign(tr, { x: from.x, y: from.y, z: from.z, dx: dx / L, dy: dy / L, dz: dz / L, len: 0, total: L, sp: speed, life: L / speed });
  }
  update(dt) {
    let a = 0;
    for (let i = 0; i < this.cap; i++) {
      const tr = this.t[i], k = i * 6;
      if (tr.life <= 0) { for (let j = 0; j < 6; j++) this.pos[k + j] = 0; continue; }
      a++; tr.life -= dt; tr.len += tr.sp * dt; const h = Math.min(tr.len, tr.total), tl = Math.max(0, h - 5);
      this.pos[k] = tr.x + tr.dx * tl; this.pos[k + 1] = tr.y + tr.dy * tl; this.pos[k + 2] = tr.z + tr.dz * tl;
      this.pos[k + 3] = tr.x + tr.dx * h; this.pos[k + 4] = tr.y + tr.dy * h; this.pos[k + 5] = tr.z + tr.dz * h;
    }
    this.active = a; this.geo.attributes.position.needsUpdate = true;
  }
}

export class Popups {
  constructor(root) { this.root = root; this.list = []; this.v = new THREE.Vector3(); }
  add(text, pos, cls = '') {
    const el = document.createElement('div'); el.className = 'pop ' + cls; el.textContent = text; this.root.appendChild(el);
    this.list.push({ el, p: pos.clone(), t: 0 }); if (this.list.length > 14) { const o = this.list.shift(); o.el.remove(); }
  }
  update(dt, camera, w, h) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i]; o.t += dt; if (o.t > 1.2) { o.el.remove(); this.list.splice(i, 1); continue; }
      this.v.copy(o.p); this.v.y += o.t * 6; this.v.project(camera);
      if (this.v.z > 1) { o.el.style.opacity = 0; continue; }
      o.el.style.transform = `translate(${(this.v.x * 0.5 + 0.5) * w}px,${(-this.v.y * 0.5 + 0.5) * h}px) translate(-50%,-50%) scale(${1 + 0.3 * Math.max(0, 0.2 - o.t) * 5})`;
      o.el.style.opacity = o.t > 0.8 ? (1.2 - o.t) / 0.4 : 1;
    }
  }
}

// Tiny synth sound effects (no audio files).
export class Sfx {
  constructor() { this.ctx = null; this.on = true; this.last = {}; }
  unlock() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  noise(dur, freq, vol, type = 'lowpass') {
    const c = this.ctx; if (!c || !this.on) return; const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = c.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(c.destination); s.start();
  }
  tone(f0, f1, dur, vol, type = 'square') {
    const c = this.ctx; if (!c || !this.on) return; const o = c.createOscillator(), g = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, c.currentTime); o.frequency.exponentialRampToValueAtTime(f1, c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur);
  }
  play(name) {
    const now = performance.now(); if (this.last[name] && now - this.last[name] < 45) return; this.last[name] = now;
    switch (name) {
      case 'punch': this.noise(0.18, 500, 0.5); this.tone(140, 50, 0.15, 0.25, 'sine'); break;
      case 'glass': this.noise(0.25, 4000, 0.25, 'highpass'); break;
      case 'crumble': this.noise(0.5, 300, 0.4); break;
      case 'boom': this.noise(1.2, 200, 0.9); this.tone(90, 30, 0.8, 0.4, 'sine'); break;
      case 'rumble': this.noise(2.2, 120, 0.8); break;
      case 'gun': this.noise(0.05, 2500, 0.12, 'bandpass'); break;
      case 'gulp': this.tone(300, 90, 0.3, 0.3, 'sine'); break;
      case 'grab': this.tone(200, 400, 0.12, 0.15, 'triangle'); break;
      case 'throw': this.noise(0.3, 900, 0.2, 'bandpass'); break;
      case 'jump': this.tone(180, 320, 0.15, 0.12, 'triangle'); break;
    }
  }
}
