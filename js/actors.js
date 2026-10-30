// Traffic (cartoon cars), police & army men, and the army helicopter. Plus grabbing, throwing and eating.
import * as THREE from '../vendor/three.module.min.js';
import { toon, mergeColored, M, rand, clamp } from './util.js';
import { NB, PITCH, HALF, streetLine } from './city.js';

const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d), CYL = (a, b, h, n = 12) => new THREE.CylinderGeometry(a, b, h, n), SPH = (r, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);
const CAR_COLORS = ['#ff4d4d', '#3fa7ff', '#ffd23f', '#5ee06b', '#ff8c2b', '#c77dff', '#ffffff', '#ff7eb6'];

function carGeo(color, kind) {
  const P = [];
  const glass = '#2c4a6e', tyre = '#1d1d22', trim = '#cfd3d8';
  if (kind === 'bus') {
    P.push([BOX(2.6, 2.6, 8.5), color, M(0, 1.9, 0)], [BOX(2.7, 0.9, 7.6), glass, M(0, 2.4, -0.2)], [BOX(2.4, 1.0, 0.1), glass, M(0, 2.4, 4.26)], [BOX(2.65, 0.3, 8.6), trim, M(0, 0.75, 0)]);
    for (const z of [-2.8, 2.8]) for (const x of [-1.25, 1.25]) P.push([CYL(0.62, 0.62, 0.5), tyre, M(x, 0.62, z, 0, 0, Math.PI / 2)]);
    P.push([SPH(0.25), '#fff6a0', M(-0.8, 1.3, 4.27)], [SPH(0.25), '#fff6a0', M(0.8, 1.3, 4.27)]);
    return mergeColored(P);
  }
  P.push([BOX(2.2, 1.0, 4.4), color, M(0, 0.95, 0)], [BOX(1.95, 0.95, 2.3), glass, M(0, 1.9, -0.25)], [BOX(2.0, 0.18, 2.1), color, M(0, 2.42, -0.3)],
    [BOX(2.25, 0.3, 0.3), trim, M(0, 0.6, 2.2)], [BOX(2.25, 0.3, 0.3), trim, M(0, 0.6, -2.2)], [SPH(0.22), '#fff6a0', M(-0.7, 1.05, 2.2)], [SPH(0.22), '#fff6a0', M(0.7, 1.05, 2.2)],
    [SPH(0.2), '#ff3030', M(-0.75, 1.05, -2.21)], [SPH(0.2), '#ff3030', M(0.75, 1.05, -2.21)]);
  for (const z of [-1.4, 1.4]) for (const x of [-1.05, 1.05]) P.push([CYL(0.48, 0.48, 0.42), tyre, M(x, 0.48, z, 0, 0, Math.PI / 2)], [CYL(0.22, 0.22, 0.44), trim, M(x, 0.48, z, 0, 0, Math.PI / 2)]);
  if (kind === 'police') P.push([BOX(2.21, 0.35, 2.0), '#1d3fbf', M(0, 1.05, 0.2)], [BOX(0.5, 0.3, 0.4), '#ff2a2a', M(-0.35, 2.66, -0.3)], [BOX(0.5, 0.3, 0.4), '#2a6aff', M(0.35, 2.66, -0.3)]);
  if (kind === 'taxi') P.push([BOX(0.9, 0.35, 0.5), '#222', M(0, 2.68, -0.3)]);
  return mergeColored(P);
}
function tankGeo() {
  const g = '#6b8a3e', d = '#4a6229', t = '#2a2a2e';
  const P = [[BOX(3.4, 1.3, 6.0), g, M(0, 1.35, 0)], [BOX(3.0, 0.5, 5.2), d, M(0, 2.2, -0.2)], [BOX(3.6, 0.25, 6.3), d, M(0, 2.0, 0)]];
  for (const x of [-1.85, 1.85]) { P.push([BOX(0.9, 1.3, 6.4), t, M(x, 0.65, 0)]); for (const z of [-2.4, -1.2, 0, 1.2, 2.4]) P.push([CYL(0.55, 0.55, 0.95, 10), '#555', M(x, 0.62, z, 0, 0, Math.PI / 2)]); }
  P.push([BOX(0.6, 0.4, 0.2), '#fff', M(-1.75, 1.6, 3.02)], [SPH(0.2), '#fff6a0', M(1.2, 1.5, 3.0)]);
  return mergeColored(P);
}
function turretGeo() {
  const g = '#6b8a3e', d = '#4a6229';
  return mergeColored([[CYL(1.4, 1.6, 1.0, 14), g, M(0, 0, 0)], [SPH(1.0, 12, 8), d, M(0, 0.45, -0.3, 0, 0, 0, 1, 0.5, 1)], [CYL(0.22, 0.26, 4.2, 10), d, M(0, 0.05, 2.6, Math.PI / 2, 0, 0)], [CYL(0.34, 0.34, 0.6, 10), '#333', M(0, 0.05, 4.6, Math.PI / 2, 0, 0)], [CYL(0.3, 0.3, 0.3, 8), '#333', M(0.6, 0.65, -0.6)]]);
}
function personGeo(army) {
  const uni = army ? '#5a7a3a' : '#2b4fa8', dark = army ? '#3d5428' : '#1b2a55', skin = '#f1c39a';
  return mergeColored([
    [CYL(0.22, 0.2, 1.0, 8), dark, M(-0.22, 0.5, 0)], [CYL(0.22, 0.2, 1.0, 8), dark, M(0.22, 0.5, 0)],
    [CYL(0.45, 0.5, 1.1, 10), uni, M(0, 1.5, 0)], [SPH(0.4, 12, 10), skin, M(0, 2.35, 0)],
    army ? [SPH(0.46, 12, 8), '#4b6630', M(0, 2.5, 0, 0, 0, 0, 1, 0.7, 1)] : [CYL(0.45, 0.42, 0.3, 12), '#111', M(0, 2.68, 0)],
    army ? [BOX(0.1, 0.1, 0.1), uni, M(0, 0, 0)] : [BOX(0.7, 0.08, 0.35), '#111', M(0, 2.55, 0.3)],
    [SPH(0.07, 6, 4), '#111', M(-0.14, 2.4, 0.36)], [SPH(0.07, 6, 4), '#111', M(0.14, 2.4, 0.36)],
    [CYL(0.14, 0.14, 0.9, 6), uni, M(0.5, 1.6, 0.3, -1.3, 0, 0)], [CYL(0.14, 0.14, 0.9, 6), uni, M(-0.5, 1.6, 0.3, -1.3, 0, 0)],
    [BOX(0.2, 0.25, army ? 1.3 : 0.55), '#222', M(0, 1.7, army ? 0.95 : 0.75)],
  ]);
}
function heliGeo() {
  const g = '#5d7a3c', d = '#3f5628';
  return mergeColored([
    [SPH(1, 16, 12), g, M(0, 0, 0, 0, 0, 0, 1.7, 1.5, 2.8)], [SPH(1, 14, 10), '#9fd8ff', M(0, 0.25, 1.9, 0, 0, 0, 1.2, 1.0, 1.1)],
    [CYL(0.35, 0.55, 5.5, 10), g, M(0, 0.3, -4.6, Math.PI / 2, 0, 0)], [BOX(0.25, 1.9, 1.3), d, M(0, 1.1, -7.2)], [BOX(2.4, 0.15, 0.8), d, M(0, 0.4, -6.9)],
    [BOX(0.18, 0.18, 4.6), '#333', M(-1.3, -1.9, 0.2)], [BOX(0.18, 0.18, 4.6), '#333', M(1.3, -1.9, 0.2)],
    [BOX(0.15, 0.9, 0.15), '#333', M(-1.1, -1.45, 1.2)], [BOX(0.15, 0.9, 0.15), '#333', M(1.1, -1.45, 1.2)], [BOX(0.15, 0.9, 0.15), '#333', M(-1.1, -1.45, -0.9)], [BOX(0.15, 0.9, 0.15), '#333', M(1.1, -1.45, -0.9)],
    [CYL(0.3, 0.3, 0.6, 8), '#444', M(0, 1.55, 0)], [CYL(0.12, 0.12, 1.6, 6), '#222', M(0, -1.2, 2.3, Math.PI / 2, 0, 0)],
    [BOX(0.1, 0.5, 0.5), '#fff', M(1.71, 0.2, -0.3)], [BOX(0.1, 0.5, 0.5), '#fff', M(-1.71, 0.2, -0.3)],
  ]);
}

export class Actors {
  constructor(G) {
    this.G = G; this.cars = []; this.people = []; this.heli = null; this.hits = [];
    this.matV = toon({ vertexColors: true }); this.matWreck = toon({ vertexColors: true, color: 0x4a4440 });
    this.carGeos = CAR_COLORS.map(c => carGeo(c, 'car')); this.policeGeo = carGeo('#ffffff', 'police'); this.taxiGeo = carGeo('#ffd23f', 'taxi'); this.busGeo = carGeo('#ff9a2b', 'bus');
    this.tankGeo = tankGeo(); this.turretGeo = turretGeo(); this.tankTimer = rand(70, 100);
    this.copGeo = personGeo(false); this.armyGeo = personGeo(true); this.heliBody = heliGeo();
    this.rotorGeo = mergeColored([[BOX(15, 0.12, 0.6), '#2a2a2a'], [BOX(0.6, 0.12, 15), '#2a2a2a']]);
    this.tailRotorGeo = mergeColored([[BOX(0.1, 2.6, 0.3), '#2a2a2a'], [BOX(0.1, 0.3, 2.6), '#2a2a2a']]);
    this.peopleTimer = 6; this.t = 0;
    const n = G.lowGfx ? 14 : 24; for (let i = 0; i < n; i++) this.spawnCar(true);
  }
  // ---------- cars ----------
  spawnCar(anywhere, forceKind) {
    const G = this.G, mp = G.monkey ? G.monkey.pos : new THREE.Vector3();
    let k, a, dx = 0, dz = 0, horiz;
    for (let t = 0; t < 20; t++) {
      horiz = Math.random() < 0.5; k = Math.floor(Math.random() * (NB + 1)); const sgn = Math.random() < 0.5 ? 1 : -1; if (horiz) dx = sgn; else dz = sgn; if (horiz) dz = 0; else dx = 0;
      a = -HALF + 8 + Math.random() * NB * PITCH;
      const x = horiz ? a : streetLine(k), z = horiz ? streetLine(k) : a;
      if (anywhere ? Math.hypot(x - mp.x, z - mp.z) > 20 : Math.hypot(x - mp.x, z - mp.z) > 70) break;
    }
    const r = Math.random(), kind = forceKind || (r < 0.12 ? 'police' : r < 0.24 ? 'taxi' : r < 0.32 ? 'bus' : 'car');
    const geo = kind === 'tank' ? this.tankGeo : kind === 'police' ? this.policeGeo : kind === 'taxi' ? this.taxiGeo : kind === 'bus' ? this.busGeo : this.carGeos[Math.floor(Math.random() * this.carGeos.length)];
    const mesh = new THREE.Mesh(geo, this.matV); this.G.scene.add(mesh);
    const c = { mesh, kind, state: 'drive', dx, dz, k, a, speed: rand(7, 11), cruise: rand(7, 11), vel: new THREE.Vector3(), spin: new THREE.Vector3(), burn: 0, life: 0, uturn: 0, wob: Math.random() * 6, heading: Math.atan2(dx, dz), len: kind === 'bus' ? 8.5 : kind === 'tank' ? 6.5 : 4.4 };
    if (kind === 'tank') { c.cruise = c.speed = 6; c.hp = 3; c.shootCd = rand(1.5, 3); c.turret = new THREE.Mesh(this.turretGeo, this.matV); c.turret.position.y = 2.9; mesh.add(c.turret); }
    c.ni = this.nextInt(c); this.placeCar(c); this.cars.push(c); return c;
  }
  spawnTank(anywhere = false) { const c = this.spawnCar(anywhere, 'tank'); this.G.toast('🪖 Army tank rolling in!'); return c; }
  tankShoot(c) { // cartoon cannon shell: big tracer, muzzle flash + smoke, cosmetic blast on the monkey
    const G = this.G, mp = G.monkey.pos; c.turret.updateMatrixWorld(true);
    const from = new THREE.Vector3(0, 0.05, 5).applyMatrix4(c.turret.matrixWorld), to = new THREE.Vector3(mp.x + rand(-1, 1), mp.y + rand(5, 9), mp.z + rand(-1, 1));
    G.tracers.fire(from, to, 110); for (let i = 0; i < 6; i++) G.fire.emit(from.x, from.y, from.z, rand(-3, 3), rand(0, 3), rand(-3, 3), 0.15, 3, 1, 1, 0.8, 0.35, 1); G.smoke.emit(from.x, from.y, from.z, 0, 2, 0, 1.6, 2, 6, 0.8, 0.8, 0.8, 0.5);
    G.sfx.play('boom'); this.hits.push({ t: from.distanceTo(to) / 110, p: to, big: true });
  }
  nextInt(c) { const sgn = c.dx || c.dz, u = (c.a - streetLine(0)) / PITCH; return sgn > 0 ? Math.floor(u + 1e-3) + 1 : Math.ceil(u - 1e-3) - 1; }
  placeCar(c, wob = 0) {
    const sgn = c.dx || c.dz, line = streetLine(c.k), off = 3.6 + wob;
    if (c.dx) c.mesh.position.set(c.a, 0, line - c.dx * off); else c.mesh.position.set(line + c.dz * off, 0, c.a);
  }
  intersection(c) {
    const sgn = c.dx || c.dz, ni = c.ni, opts = [];
    if (ni + sgn >= 0 && ni + sgn <= NB) opts.push('s', 's');
    for (const ns of [-1, 1]) if (c.k + ns >= 0 && c.k + ns <= NB) opts.push(ns);
    if (!opts.length) opts.push('u');
    const o = opts[Math.floor(Math.random() * opts.length)];
    if (o === 's') { c.ni += sgn; return; }
    if (o === 'u') { c.dx = -c.dx; c.dz = -c.dz; c.ni = this.nextInt(c); return; }
    const oldK = c.k; c.k = ni; c.a = streetLine(oldK); if (c.dx) { c.dx = 0; c.dz = o; } else { c.dz = 0; c.dx = o; } c.ni = oldK + o;
  }
  wreck(c, explode = false) {
    if (c.state === 'wreck' || c.state === 'dead') { if (explode && c.burn >= 0) { c.burn = -1; this.G.explode(c.mesh.position.clone().setY(c.mesh.position.y + 1), 1); } return; }
    const G = this.G; c.state = c.state === 'thrown' ? 'thrown' : 'wreck'; c.mesh.material = this.matWreck; if (c.turret) c.turret.material = this.matWreck; c.mesh.scale.set(1.08, c.kind === 'tank' ? 0.8 : 0.62, 0.86); c.wrecked = true; c.life = 0;
    G.onWreck(c); if (explode) { c.burn = -1; G.explode(c.mesh.position.clone().setY(1.5), 1); } else if (Math.random() < 0.55) c.burn = rand(5, 10);
  }
  // ---------- people ----------
  spawnPerson(army) {
    const G = this.G, mp = G.monkey.pos; let x, z;
    for (let t = 0; t < 30; t++) { const ang = Math.random() * 6.28, d = rand(38, 55); x = clamp(mp.x + Math.cos(ang) * d, -HALF + 2, HALF - 2); z = clamp(mp.z + Math.sin(ang) * d, -HALF + 2, HALF - 2); if (!G.city.buildingAt(x, 1, z, 1.5)) break; }
    const mesh = new THREE.Mesh(army ? this.armyGeo : this.copGeo, this.matV); mesh.scale.setScalar(1.35); mesh.position.set(x, 0, z); G.scene.add(mesh);
    const p = { mesh, army, state: 'run', cd: rand(1, 2.5), burst: 0, ang: Math.random() * 6.28, dist: rand(15, 26), vel: new THREE.Vector3(), t: Math.random() * 5 };
    this.people.push(p); return p;
  }
  // ---------- helicopter ----------
  spawnHeli() {
    if (this.heli) return this.heli; const G = this.G, mp = G.monkey.pos, ang = Math.random() * 6.28;
    const grp = new THREE.Group(), body = new THREE.Mesh(this.heliBody, this.matV), rotor = new THREE.Mesh(this.rotorGeo, this.matV), tr = new THREE.Mesh(this.tailRotorGeo, this.matV);
    rotor.position.y = 1.9; tr.position.set(0.35, 1.0, -7.3); grp.add(body, rotor, tr); grp.position.set(mp.x + Math.cos(ang) * 160, 45, mp.z + Math.sin(ang) * 160); grp.scale.setScalar(1.15);
    G.scene.add(grp); this.heli = { g: grp, rotor, tr, state: 'arrive', ang, t: 0, dive: rand(5, 8), shootCd: 2, burst: 0, vel: new THREE.Vector3(), hp: 2, smoke: 0, anchor: mp.clone() };
    G.toast('🚁 Army chopper incoming!'); return this.heli;
  }

  findGrab(monkey) {
    const hand = monkey.handPos(), f = monkey.forward(), front = monkey.pos.clone().addScaledVector(f, 3.5); let best = null, bd = 1e9;
    const h = this.heli; if (h && (h.state === 'circle' || h.state === 'dive' || h.state === 'arrive')) { const hp = h.g.position, d = Math.hypot(hp.x - monkey.pos.x, hp.z - monkey.pos.z); if (d < 12.5 && Math.abs(hp.y - hand.y) < 6.5) { bd = 0; best = { type: 'heli', o: h }; } }
    for (const c of this.cars) { if (c.state === 'thrown' || c.state === 'held' || c.state === 'dead') continue; const p = c.mesh.position, d = Math.hypot(p.x - front.x, p.z - front.z); if (d < 6.5 && Math.abs(p.y - monkey.pos.y) < 5 && d < bd) { bd = d; best = { type: 'car', o: c }; } }
    for (const q of this.people) { if (q.state !== 'run' && q.state !== 'shoot') continue; const p = q.mesh.position, d = Math.hypot(p.x - front.x, p.z - front.z) - 0.5; if (d < 6.5 && Math.abs(p.y - monkey.pos.y) < 5 && d < bd) { bd = d; best = { type: 'person', o: q }; } }
    return best;
  }
  holdPos(monkey, type) { const f = monkey.forward(); if (type === 'person') return monkey.pos.clone().addScaledVector(f, 2.2).add(new THREE.Vector3(0, 12.5, 0)); return monkey.pos.clone().addScaledVector(f, 0.6).add(new THREE.Vector3(0, type === 'heli' ? 15 : 13.4, 0)); }
  throwHeld(monkey, dir) {
    const h = monkey.held; if (!h || h.type === 'person') return; monkey.held = null; const o = h.o, start = this.holdPos(monkey, h.type);
    const sp = h.type === 'heli' ? 40 : 48; const v = dir.clone().multiplyScalar(sp); v.y = h.type === 'heli' ? 7 : 6;
    if (h.type === 'car') { o.state = 'thrown'; o.vel.copy(v); o.spin.set(rand(-6, 6), rand(-4, 4), rand(-6, 6)); o.mesh.position.copy(start); o.thrownBy = true; }
    else { o.state = 'thrown'; o.vel.copy(v); o.g.position.copy(start); }
    this.G.sfx.play('throw');
  }

  punch(fp, fwd) {
    const G = this.G; let hit = 0;
    for (const c of this.cars) {
      if (c.state === 'held' || c.state === 'dead') continue; const p = c.mesh.position;
      if (Math.hypot(p.x - fp.x, p.z - fp.z) < (c.kind === 'tank' ? 5.5 : 4.8) && Math.abs(p.y + 1 - fp.y) < 5) { hit++; if (c.kind === 'tank' && !c.wrecked && --c.hp > 0) { G.shake(0.2); G.smallDust(p.x, 2, p.z); G.pops.add('CLANG!', p.clone().setY(5), ''); continue; } if (c.kind === 'tank' && !c.wrecked) { this.wreck(c, true); continue; } const was = c.wrecked; this.wreck(c); c.state = 'thrown'; c.vel.set(fwd.x * 26, 11, fwd.z * 26); c.spin.set(rand(-8, 8), rand(-5, 5), rand(-8, 8)); if (was && Math.random() < 0.5) this.wreck(c, true); }
    }
    for (const q of this.people) { if (q.state !== 'run' && q.state !== 'shoot') continue; const p = q.mesh.position; if (Math.hypot(p.x - fp.x, p.z - fp.z) < 4.5 && Math.abs(p.y - fp.y) < 6) { hit++; this.fling(q, fwd, 22); } }
    const h = this.heli;
    if (h && ['circle', 'dive', 'arrive'].includes(h.state) && h.g.position.distanceTo(fp) < 7.5) { hit++; h.hp--; G.shake(0.3); G.dust(h.g.position.x, h.g.position.y, h.g.position.z, 2); if (h.hp <= 0) { h.state = 'crash'; h.vel.set(fwd.x * 14, 4, fwd.z * 14); G.toast('Chopper going down!'); } }
    return hit;
  }
  fling(q, dir, sp) { q.state = 'fly'; q.vel.set(dir.x * sp + rand(-3, 3), rand(9, 15), dir.z * sp + rand(-3, 3)); this.G.onPersonBonk(q); }

  blast(p, r) { // explosion side effects
    for (const c of this.cars) { if (c.state === 'dead' || c.state === 'held') continue; const d = c.mesh.position.distanceTo(p); if (d < r) { const was = c.wrecked; this.wreck(c); if (c.state !== 'thrown') { c.state = 'thrown'; const dir = c.mesh.position.clone().sub(p).setY(0).normalize(); c.vel.set(dir.x * 10, 8, dir.z * 10); c.spin.set(rand(-5, 5), rand(-5, 5), rand(-5, 5)); } if (was && c.burn >= 0 && Math.random() < 0.3) setTimeout(() => this.wreck(c, true), 300 + Math.random() * 500); } }
    for (const q of this.people) if ((q.state === 'run' || q.state === 'shoot') && q.mesh.position.distanceTo(p) < r) this.fling(q, q.mesh.position.clone().sub(p).setY(0).normalize(), 14);
  }

  update(dt) {
    const G = this.G, mon = G.monkey, mp = mon.pos; this.t += dt;
    // ---- cars ----
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i], m = c.mesh;
      if (c.state === 'drive') {
        const sgn = c.dx || c.dz, d = Math.hypot(m.position.x - mp.x, m.position.z - mp.z);
        const tank = c.kind === 'tank'; let target = c.cruise; const fleeing = !tank && d < 30 && mp.y < 12;
        if (fleeing) { target = 22; c.uturn -= dt; const tm = (mp.x - m.position.x) * c.dx + (mp.z - m.position.z) * c.dz; if (tm > 0 && d < 24 && c.uturn <= 0) { c.dx = -c.dx; c.dz = -c.dz; c.ni = this.nextInt(c); c.uturn = 3; G.sfx.play('grab'); } }
        const frozen = !tank && d < 9 && mp.y < 8; if (frozen) target = 0; // driver freezes in terror when the monkey is right there
        for (const o of this.cars) { if (o === c || o.state !== 'drive' || o.k !== c.k || o.dx !== c.dx || o.dz !== c.dz) continue; const ahead = (o.a - c.a) * sgn; if (ahead > 0 && ahead < (c.len + o.len) / 2 + 2.5) { target = 0; break; } }
        c.speed += (target - c.speed) * Math.min(1, dt * (frozen ? 12 : target < c.speed ? 5 : 1.5));
        const prev = c.a; c.a += sgn * c.speed * dt; const L = streetLine(c.ni);
        if ((prev - L) * sgn < 0 && (c.a - L) * sgn >= 0) this.intersection(c);
        c.wob += dt * 9; this.placeCar(c, fleeing ? Math.sin(c.wob) * 0.9 : 0);
        const hd = Math.atan2(c.dx, c.dz); let dh = hd - c.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); c.heading += dh * Math.min(1, dt * 8); m.rotation.set(0, c.heading + (fleeing ? Math.sin(c.wob) * 0.12 : 0), 0);
        if (tank) { // tank: slow down when close, swivel turret to the monkey, fire shells
          if (d < 35) target = Math.min(target, 2);
          const ta = Math.atan2(mp.x - m.position.x, mp.z - m.position.z) - m.rotation.y; let dt2 = ta - c.turret.rotation.y; dt2 = Math.atan2(Math.sin(dt2), Math.cos(dt2)); c.turret.rotation.y += dt2 * Math.min(1, dt * 3);
          c.shootCd -= dt; if (c.shootCd <= 0 && d < 95 && G.started && Math.abs(dt2) < 0.3) { c.shootCd = rand(2.6, 4); this.tankShoot(c); }
        }
        if (Math.abs(m.position.x) > HALF + 5 || Math.abs(m.position.z) > HALF + 5) { c.a = clamp(c.a, -HALF + 8, HALF - 8); this.intersection(c); }
      } else if (c.state === 'held') {
        m.position.copy(this.holdPos(mon, 'car')); m.rotation.set(0.15, mon.facing + Math.PI / 2, Math.sin(this.t * 3) * 0.1);
      } else if (c.state === 'thrown') {
        c.vel.y -= 26 * dt; m.position.addScaledVector(c.vel, dt); m.rotation.x += c.spin.x * dt; m.rotation.y += c.spin.y * dt; m.rotation.z += c.spin.z * dt;
        if (G.lowGfx ? Math.random() < 0.3 : true) G.smoke.emit(m.position.x, m.position.y, m.position.z, 0, 1, 0, 0.8, 1.2, 3, 0.85, 0.85, 0.85, 0.35);
        const b = G.city.buildingAt(m.position.x, m.position.y, m.position.z, 0.6);
        if (b) { // smash into a building
          const sp = c.vel.length(), dir = c.vel.clone().normalize();
          const r = G.city.damageSphere(m.position, c.kind === 'tank' ? 6 : 4.8, Math.max(1, sp / 12) * (c.kind === 'tank' ? 1.8 : 1), dir, c.kind === 'tank' ? 12 : 7, 'throw'); G.shake(0.35); G.sfx.play('punch'); G.dust(m.position.x, m.position.y, m.position.z, 4);
          G.onCarImpact(c, r); this.wreck(c, Math.random() < (c.thrownBy ? 0.45 : 0.2));
          if (Math.random() < 0.5) { const near = G.city.chunksNear(m.position, 6)[0]; if (near) G.city.startFire(near[0]); }
          c.vel.multiplyScalar(-0.15); c.vel.y = 0; m.position.addScaledVector(dir, -1.5); c.thrownBy = false;
        }
        if (m.position.y <= 0.05 && c.vel.y < 0) {
          if (c.thrownBy && !c.wrecked) this.wreck(c, Math.random() < 0.25); else if (!c.wrecked) this.wreck(c);
          m.position.y = 0; c.vel.y = Math.abs(c.vel.y) > 6 ? -c.vel.y * 0.3 : 0; c.vel.x *= 0.5; c.vel.z *= 0.5; c.spin.multiplyScalar(0.4); G.dust(m.position.x, 0.5, m.position.z, 2);
          if (Math.abs(c.vel.y) < 0.5 && Math.hypot(c.vel.x, c.vel.z) < 2) { c.state = 'wreck'; m.rotation.x = Math.round(m.rotation.x / Math.PI) * Math.PI; m.rotation.z = Math.round(m.rotation.z / Math.PI) * Math.PI; c.thrownBy = false; }
        }
        // thrown car hits other cars
        for (const o of this.cars) if (o !== c && o.state === 'drive' && o.mesh.position.distanceTo(m.position) < 3.5) this.wreck(o, Math.random() < 0.3);
        if (Math.abs(m.position.x) > HALF * 2 || Math.abs(m.position.z) > HALF * 2) c.state = 'dead';
      }
      if (c.wrecked && c.state !== 'held') {
        c.life += dt; if (c.burn > 0) { c.burn -= dt; const p = m.position; if (Math.random() < (G.lowGfx ? 0.4 : 0.9)) G.fire.emit(p.x + rand(-1, 1), p.y + 1.5, p.z + rand(-1, 1), 0, rand(3, 5), 0, rand(0.4, 0.8), 2.2, 0.5, 1, 0.6, 0.15, 0.9, 2); if (Math.random() < 0.15) G.smoke.emit(p.x, p.y + 2, p.z, 1, 4, 0.5, 4, 2, 8, 0.25, 0.25, 0.25, 0.55, 0.5, 0.2); if (c.burn <= 0) { if (Math.random() < 0.4) this.wreck(c, true); c.burn = 0; } }
        if (c.life > 25) { m.position.y -= dt * 0.5; if (c.life > 29) c.state = 'dead'; }
      }
      if (c.state === 'dead') { G.scene.remove(m); this.cars.splice(i, 1); }
    }
    const want = G.lowGfx ? 14 : 24; if (this.cars.filter(c => c.state === 'drive' && c.kind !== 'tank').length < want && Math.random() < dt * 0.6) this.spawnCar(false);
    // ---- tanks: arrive once the army is mobilised (some destruction or ~100 s in) ----
    this.tankTimer -= dt; const tanks = this.cars.filter(c => c.kind === 'tank' && c.state === 'drive').length;
    if (G.started && this.tankTimer <= 0 && tanks < (G.lowGfx ? 1 : 2) && (G.destroyedFrac() > 0.08 || G.time > 100)) { this.spawnTank(); this.tankTimer = rand(30, 50); }
    // ---- people ----
    this.peopleTimer -= dt; const frac = G.destroyedFrac(), maxP = Math.min(G.lowGfx ? 6 : 10, 2 + Math.floor(frac * 25));
    const active = this.people.filter(q => q.state === 'run' || q.state === 'shoot').length;
    if (G.started && (G.city.destroyed > 0 || G.time > 25) && this.peopleTimer <= 0 && active < maxP) { this.peopleTimer = rand(2.5, 5); this.spawnPerson((frac > 0.06 || G.time > 80) && Math.random() < 0.6); }
    for (let i = this.people.length - 1; i >= 0; i--) {
      const q = this.people[i], m = q.mesh; q.t += dt;
      if (q.state === 'run' || q.state === 'shoot') {
        const tx = mp.x + Math.cos(q.ang) * q.dist, tz = mp.z + Math.sin(q.ang) * q.dist, dx = tx - m.position.x, dz = tz - m.position.z, d = Math.hypot(dx, dz);
        if (d > 2) { q.state = 'run'; const sp = 8; let nx = m.position.x + dx / d * sp * dt, nz = m.position.z + dz / d * sp * dt; if (G.city.buildingAt(nx, 1, nz, 1)) { if (!G.city.buildingAt(nx, 1, m.position.z, 1)) nz = m.position.z; else if (!G.city.buildingAt(m.position.x, 1, nz, 1)) nx = m.position.x; else { nx = m.position.x; nz = m.position.z; q.ang += 1; } } m.position.x = nx; m.position.z = nz; m.position.y = Math.abs(Math.sin(q.t * 12)) * 0.35; m.rotation.y = Math.atan2(dx, dz); }
        else { q.state = 'shoot'; m.position.y = 0; m.rotation.y = Math.atan2(mp.x - m.position.x, mp.z - m.position.z); if (Math.random() < dt * 0.15) q.ang += rand(-1, 1); }
        q.cd -= dt; const dm = Math.hypot(mp.x - m.position.x, mp.z - m.position.z);
        if (q.cd <= 0 && dm < 45) { if (q.army) { q.burst = 3; q.cd = rand(1.8, 2.6); } else { q.burst = 1; q.cd = rand(1.3, 2.2); } }
        if (q.burst > 0 && (q.bt = (q.bt || 0) - dt) <= 0) { q.burst--; q.bt = 0.12; m.rotation.y = Math.atan2(mp.x - m.position.x, mp.z - m.position.z); this.shoot(new THREE.Vector3(m.position.x + Math.sin(m.rotation.y) * 1.6, 2.3, m.position.z + Math.cos(m.rotation.y) * 1.6)); }
        if (dm > 120) { G.scene.remove(m); this.people.splice(i, 1); }
      } else if (q.state === 'held') {
        const hp = this.holdPos(mon, 'person'); m.rotation.set(0, mon.facing, Math.sin(q.t * 20) * 0.4);
        const k = clamp(1 - mon.eatT / 1.0, 0, 1); // move to mouth and shrink
        const mouth = mon.pos.clone().addScaledVector(mon.forward(), 2.6).add(new THREE.Vector3(0, 8.6, 0)); m.position.lerpVectors(hp, mouth, clamp(k * 1.6, 0, 1)); m.scale.setScalar(1.35 * (1 - clamp((k - 0.55) / 0.35, 0, 1)));
        if (mon.eatT <= 0) { G.scene.remove(m); this.people.splice(i, 1); mon.held = null; G.onEat(q); }
      } else if (q.state === 'fly') {
        q.vel.y -= 28 * dt; m.position.addScaledVector(q.vel, dt); m.rotation.x += dt * 12; m.rotation.z += dt * 7;
        if (m.position.y <= 0 && q.vel.y < 0) { G.poof(m.position); G.scene.remove(m); this.people.splice(i, 1); }
      }
    }
    // ---- helicopter ----
    G.heliTimer -= dt; if (!this.heli && G.heliTimer <= 0 && G.started) { this.spawnHeli(); G.heliTimer = rand(45, 90) * (1 - 0.5 * frac); }
    const h = this.heli;
    if (h) {
      h.t += dt; const g = h.g; h.rotor.rotation.y += dt * (h.state === 'held' ? 6 : 28); h.tr.rotation.x += dt * 30;
      if (h.state === 'arrive' || h.state === 'circle' || h.state === 'dive') {
        h.dive -= dt; if (h.state === 'circle' && h.dive <= 0) { h.state = 'dive'; h.dive = 5; } else if (h.state === 'dive' && h.dive <= 0) { h.state = 'circle'; h.dive = rand(7, 10); }
        h.ang += dt * (h.state === 'dive' ? 0.5 : 0.4); h.anchor.lerp(mp, Math.min(1, dt * 0.3));
        const gy = mon.state === 'climb' ? 0 : mon.groundAt(mp.x, mp.z, mp.y + 0.1);
        const rad = h.state === 'dive' ? 10 : 16, alt = h.state === 'dive' ? gy + 20 : Math.max(34, gy + 17);
        const tx = h.anchor.x + Math.cos(h.ang) * rad, tz = h.anchor.z + Math.sin(h.ang) * rad;
        const k = Math.min(1, dt * (h.state === 'arrive' ? 0.6 : 1.4)); const ox = g.position.x, oz = g.position.z;
        g.position.x += (tx - g.position.x) * k; g.position.z += (tz - g.position.z) * k; g.position.y += (alt - g.position.y) * Math.min(1, dt * 1.2);
        if (h.state === 'arrive' && Math.hypot(tx - g.position.x, tz - g.position.z) < 6) { h.state = 'circle'; h.dive = rand(5, 8); }
        g.rotation.set(0, Math.atan2(mp.x - g.position.x, mp.z - g.position.z), 0); g.rotateX(0.12); g.rotateZ(clamp(((g.position.x - ox) * Math.cos(g.rotation.y) - (g.position.z - oz) * Math.sin(g.rotation.y)) * -0.4, -0.35, 0.35));
        if (h.state !== 'arrive') { h.shootCd -= dt; if (h.shootCd <= 0) { h.burst = 6; h.shootCd = rand(1.8, 2.6); } if (h.burst > 0 && (h.bt = (h.bt || 0) - dt) <= 0) { h.burst--; h.bt = 0.08; const f = new THREE.Vector3(0, -1.2, 3).applyMatrix4(g.matrixWorld); this.shoot(f); } }
      } else if (h.state === 'held') {
        g.position.copy(this.holdPos(mon, 'heli')); g.rotation.set(0.3, mon.facing + Math.PI / 2, Math.PI * 0.85); h.smoke += dt;
        if (Math.random() < 0.4) G.smoke.emit(g.position.x, g.position.y + 1, g.position.z, 0, 3, 0, 2, 2, 7, 0.2, 0.2, 0.2, 0.6, 0.5, 0.3);
      } else if (h.state === 'thrown' || h.state === 'crash') {
        h.vel.y -= (h.state === 'crash' ? 14 : 22) * dt; g.position.addScaledVector(h.vel, dt); g.rotation.y += dt * 8; g.rotation.z += dt * 2;
        G.smoke.emit(g.position.x, g.position.y, g.position.z, 0, 2, 0, 3, 2.5, 9, 0.18, 0.18, 0.18, 0.7, 0.5, 0.3);
        if (Math.random() < 0.7) G.fire.emit(g.position.x, g.position.y, g.position.z, 0, 2, 0, 0.5, 3, 1, 1, 0.6, 0.1, 0.9);
        const b = G.city.buildingAt(g.position.x, g.position.y, g.position.z, 1);
        if (b || g.position.y <= 1) this.heliBoom(g.position.clone(), b, h.vel.clone().normalize());
      }
    }
    // ---- bullets reaching the monkey ----
    for (let i = this.hits.length - 1; i >= 0; i--) { const t = this.hits[i]; t.t -= dt; if (t.t <= 0) { this.hits.splice(i, 1); G.monkeyHit(t.p); if (t.big) { G.shake(0.25); for (let k = 0; k < 14; k++) G.fire.emit(t.p.x, t.p.y, t.p.z, rand(-8, 8), rand(-2, 8), rand(-8, 8), 0.3, 3, 0.5, 1, 0.7, 0.25, 1); G.smoke.emit(t.p.x, t.p.y, t.p.z, 0, 2, 0, 1.5, 2, 6, 0.4, 0.4, 0.4, 0.6); } } }
  }
  heliBoom(p, b, dir) {
    this.G.heliTimer = Math.max(this.G.heliTimer, rand(45, 90) * (1 - 0.5 * this.G.destroyedFrac())); // next chopper only after a breather
    const G = this.G; G.explode(p, 2.6); if (b) { G.city.damageSphere(p, 8, 6, dir, 30, 'boom'); const near = G.city.chunksNear(p, 9); for (let k = 0; k < Math.min(3, near.length); k++) G.city.startFire(near[k][0]); }
    G.scene.remove(this.heli.g); this.heli = null; G.onHeliDown(p);
  }
  crushHeld(mon) {
    const h = mon.held; if (!h) return false; mon.held = null; const G = this.G;
    if (h.type === 'heli') { const p = h.o.g.position.clone(); this.heliBoom(p, null, mon.forward()); return true; }
    if (h.type === 'car') { const c = h.o; c.state = 'thrown'; c.vel.set(0, 2, 0); this.wreck(c, true); G.onCrush(c); return true; }
    return false;
  }
  shoot(from) {
    const G = this.G, mp = G.monkey.pos, to = new THREE.Vector3(mp.x + rand(-1.5, 1.5), mp.y + rand(4, 10), mp.z + rand(-1.5, 1.5));
    G.tracers.fire(from, to, 170); G.fire.emit(from.x, from.y, from.z, 0, 0, 0, 0.08, 1.6, 0.6, 1, 0.9, 0.5, 1); G.sfx.play('gun');
    this.hits.push({ t: from.distanceTo(to) / 170, p: to });
  }
}
