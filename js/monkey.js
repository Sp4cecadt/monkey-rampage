// Bananas the giant monkey: primitive-built cartoon gorilla, animation, movement, climbing, punching, grabbing.
import * as THREE from '../vendor/three.module.min.js';
import { toon, clamp } from './util.js';
import { HALF } from './city.js';

const R = 2.3, SPEED = 15, CLIMB = 9, GRAV = 34, JUMP = 21;

export function buildMonkeyModel() {
  const fur = toon({ color: 0x6b3f22 }), dark = toon({ color: 0x4a2a16 }), skin = toon({ color: 0xe8b98c }), chest = toon({ color: 0xa8714a }),
    white = toon({ color: 0xffffff }), black = toon({ color: 0x151515 }), mouthM = toon({ color: 0x7a1f1f });
  const mats = [fur, dark, skin, chest];
  const S = (r, m, w = 18, h = 14) => new THREE.Mesh(new THREE.SphereGeometry(r, w, h), m);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const torso = S(1, fur); torso.scale.set(3.1, 3.4, 2.5); torso.position.set(0, 6.3, 0); body.add(torso);
  const belly = S(1, chest); belly.scale.set(2.2, 2.5, 1.2); belly.position.set(0, 5.9, 1.45); body.add(belly);
  const pecs = S(1, chest); pecs.scale.set(2.5, 1.2, 1.1); pecs.position.set(0, 7.6, 1.5); body.add(pecs);
  const head = new THREE.Group(); head.position.set(0, 9.5, 0.9); body.add(head);
  const skull = S(1.75, fur); skull.scale.set(1, 1.05, 0.95); head.add(skull);
  const crest = S(1, fur); crest.scale.set(1.1, 1.0, 1.1); crest.position.set(0, 1.1, -0.3); head.add(crest);
  const face = S(1, skin); face.scale.set(1.45, 1.25, 0.9); face.position.set(0, -0.05, 1.05); head.add(face);
  const muzzle = S(1, skin); muzzle.scale.set(1.25, 0.85, 0.85); muzzle.position.set(0, -0.75, 1.55); head.add(muzzle);
  const jaw = new THREE.Group(); jaw.position.set(0, -1.05, 1.3); head.add(jaw);
  const mouth = S(1, mouthM, 14, 8); mouth.scale.set(0.8, 0.35, 0.5); mouth.position.set(0, 0, 0.75); mouth.visible = false; jaw.add(mouth);
  const chin = S(1, skin); chin.scale.set(1.0, 0.45, 0.75); chin.position.set(0, -0.25, 0.35); jaw.add(chin);
  for (const s of [-1, 1]) {
    const nos = S(0.17, black, 8, 6); nos.position.set(0.3 * s, -0.45, 2.33); head.add(nos);
    const eye = S(0.42, white, 12, 10); eye.position.set(0.55 * s, 0.35, 1.75); head.add(eye);
    const pup = S(0.2, black, 10, 8); pup.position.set(0.55 * s, 0.35, 2.12); head.add(pup);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.28, 0.4), dark); brow.position.set(0.55 * s, 0.85, 1.85); brow.rotation.z = -0.25 * s; head.add(brow);
    const ear = S(0.55, skin, 10, 8); ear.scale.set(0.5, 1, 0.8); ear.position.set(1.75 * s, 0.1, 0); head.add(ear);
  }
  const arm = s => {
    const sh = new THREE.Group(); sh.position.set(2.7 * s, 8.0, 0.1); body.add(sh);
    const shoulder = S(1.15, fur); sh.add(shoulder);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.8, 3.2, 12), fur); up.position.y = -1.6; sh.add(up);
    const el = new THREE.Group(); el.position.y = -3.2; sh.add(el);
    const elb = S(0.85, fur, 12, 10); el.add(elb);
    const fo = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.95, 3.0, 12), fur); fo.position.y = -1.5; el.add(fo);
    const fist = S(1.1, dark, 14, 10); fist.position.y = -3.2; fist.scale.set(1, 0.9, 1.05); el.add(fist);
    const hand = new THREE.Object3D(); hand.position.y = -3.3; el.add(hand);
    return { sh, el, fist, hand };
  };
  const leg = s => {
    const hip = new THREE.Group(); hip.position.set(1.35 * s, 3.6, -0.2); body.add(hip);
    const th = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.85, 2.4, 12), fur); th.position.y = -1.2; hip.add(th);
    const foot = S(1, dark, 12, 8); foot.scale.set(0.95, 0.5, 1.4); foot.position.set(0, -2.9, 0.45); hip.add(foot);
    return hip;
  };
  const L = arm(1), Rr = arm(-1), legL = leg(1), legR = leg(-1);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(3.4, 24), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  return { root, body, head, jaw, mouth, armL: L, armR: Rr, legL, legR, mats, shadow };
}

export class Monkey {
  constructor(G) {
    this.G = G; this.m = buildMonkeyModel(); G.scene.add(this.m.root); G.scene.add(this.m.shadow);
    this.pos = new THREE.Vector3(0, 0, 0); this.vy = 0; this.facing = Math.PI; this.state = 'ground';
    this.walkT = 0; this.punchT = 0; this.punchArm = 0; this.punchCd = 0; this.hitDone = true; this.climbT = 0; this.wallPush = 0;
    this.climb = null; this.held = null; this.eatT = 0; this.flash = 0; this.moving = 0; this.lastContact = null; this.jumped = 0;
    this.v = new THREE.Vector3();
  }
  forward() { return new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)); }
  handPos() { const f = this.forward(); return new THREE.Vector3(this.pos.x + f.x * 1.5, this.pos.y + 12.5, this.pos.z + f.z * 1.5); }
  groundAt(x, z, y) {
    let g = 0; for (const b of this.G.city.buildings) { if (b.dead) continue; const t = b.h - b.sink; if (x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3 && y >= t - 2.5 && t > g) g = t; } return g;
  }
  collide() {
    this.lastContact = null; const p = this.pos;
    for (const b of this.G.city.buildings) {
      if (b.dead) continue; const t = b.h - b.sink; if (p.y >= t - 0.6) continue;
      const ex0 = b.x0 - R, ex1 = b.x1 + R, ez0 = b.z0 - R, ez1 = b.z1 + R;
      if (p.x <= ex0 || p.x >= ex1 || p.z <= ez0 || p.z >= ez1) continue;
      const pen = [[p.x - ex0, -1, 0], [ex1 - p.x, 1, 0], [p.z - ez0, 0, -1], [ez1 - p.z, 0, 1]].sort((a, c) => a[0] - c[0])[0];
      p.x += pen[1] * pen[0]; p.z += pen[2] * pen[0]; this.lastContact = { b, n: new THREE.Vector3(pen[1], 0, pen[2]) };
    }
  }
  startClimb(b, n) {
    if (b.collapsing) return false;
    this.state = 'climb'; this.climb = { b, n: n.clone() }; this.vy = 0; this.facing = Math.atan2(-n.x, -n.z); this.snapToFace(); this.G.sfx.play('grab'); return true;
  }
  snapToFace() { const { b, n } = this.climb, p = this.pos; if (n.x > 0) p.x = b.x1 + R; else if (n.x < 0) p.x = b.x0 - R; if (n.z > 0) p.z = b.z1 + R; else if (n.z < 0) p.z = b.z0 - R; if (n.x) p.z = clamp(p.z, b.z0 + 0.5, b.z1 - 0.5); else p.x = clamp(p.x, b.x0 + 0.5, b.x1 - 0.5); }
  nearWall() { // closest building face within 2 units
    let best = null, bd = 2.2; const p = this.pos;
    for (const b of this.G.city.buildings) {
      if (b.dead || b.collapsing || p.y >= b.h - b.sink - 1) continue;
      const dx = Math.max(b.x0 - p.x, 0, p.x - b.x1), dz = Math.max(b.z0 - p.z, 0, p.z - b.z1), d = Math.hypot(dx, dz) - R;
      if (d < bd) { bd = d; const n = dx > dz ? new THREE.Vector3(p.x < b.x0 ? -1 : 1, 0, 0) : new THREE.Vector3(0, 0, p.z < b.z0 ? -1 : 1); best = { b, n }; }
    }
    return best;
  }
  letGo(push = 0) { if (this.state !== 'climb') return; const n = this.climb.n; this.state = 'air'; this.pos.x += n.x * 0.6; this.pos.z += n.z * 0.6; this.v.set(n.x * push, 0, n.z * push); this.climb = null; }

  update(dt, inp, cam) {
    const G = this.G, p = this.pos;
    const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)), fwd = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
    const mv = right.clone().multiplyScalar(inp.mx).add(fwd.clone().multiplyScalar(inp.mz)); const mlen = Math.min(1, mv.length());
    if (mlen > 0.01) mv.normalize();
    this.punchCd -= dt; this.flash = Math.max(0, this.flash - dt);
    if (inp.punch && this.punchCd <= 0 && this.eatT <= 0) { this.punchT = 0.34; this.punchCd = 0.3; this.punchArm ^= 1; this.hitDone = false; }
    if (inp.grab) this.G.grabAction();
    if (this.state === 'climb') {
      const { b, n } = this.climb;
      if (b.dead || b.collapsing) { this.letGo(); }
      else {
        const along = new THREE.Vector3(-n.z, 0, n.x); // monkey's right while facing the wall
        let lat = inp.mx * (right.dot(along) >= 0 ? 1 : -1);
        p.y += inp.mz * CLIMB * dt; p.x += along.x * lat * CLIMB * 0.8 * dt; p.z += along.z * lat * CLIMB * 0.8 * dt;
        this.moving = Math.max(Math.abs(inp.mz), Math.abs(lat));
        // wrap around corners
        const ox = n.x, oz = n.z;
        if (ox !== 0 && (p.z < b.z0 || p.z > b.z1)) { const s = p.z < b.z0 ? -1 : 1; this.climb.n.set(0, 0, s); p.x = clamp(p.x - ox * R, b.x0 + 0.5, b.x1 - 0.5); this.facing = Math.atan2(0, -s); }
        else if (oz !== 0 && (p.x < b.x0 || p.x > b.x1)) { const s = p.x < b.x0 ? -1 : 1; this.climb.n.set(s, 0, 0); p.z = clamp(p.z - oz * R, b.z0 + 0.5, b.z1 - 0.5); this.facing = Math.atan2(-s, 0); }
        this.snapToFace();
        const top = b.h - b.sink;
        if (p.y >= top - 5.5 && inp.mz > 0.3) { // mantle onto the roof
          const m = this.climb.n; p.x -= m.x * (R + 2.2); p.z -= m.z * (R + 2.2); p.y = top; this.state = 'ground'; this.climb = null; this.vy = 0;
        } else if (p.y <= 0 && inp.mz < -0.1) { p.y = 0; this.letGo(); this.state = 'ground'; }
        if (this.climb) p.y = Math.max(0, Math.min(p.y, top - 5.4 + (inp.mz > 0.3 ? 1 : 0)));
        if (this.climb && inp.jump) { const nn = this.climb.n.clone(); this.letGo(12); this.vy = JUMP * 0.7; this.facing = Math.atan2(nn.x, nn.z); G.sfx.play('jump'); }
        else if (this.climb && inp.climb) this.letGo(3);
      }
    } else {
      const sp = SPEED * (this.held ? 0.8 : 1);
      if (this.state === 'ground') { this.v.x = mv.x * sp * mlen; this.v.z = mv.z * sp * mlen; }
      else { this.v.x += (mv.x * sp * mlen - this.v.x) * Math.min(1, dt * 2); this.v.z += (mv.z * sp * mlen - this.v.z) * Math.min(1, dt * 2); }
      p.x += this.v.x * dt; p.z += this.v.z * dt; this.moving = mlen;
      if (mlen > 0.1 && this.punchT <= 0) { const tf = Math.atan2(mv.x, mv.z); let d = tf - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d)); this.facing += d * Math.min(1, dt * 12); }
      this.collide();
      const g = this.groundAt(p.x, p.z, p.y);
      if (this.state === 'ground') {
        if (inp.jump) { this.vy = JUMP; this.state = 'air'; this.jumped = 1; G.sfx.play('jump'); }
        else if (p.y > g + 0.3) this.state = 'air'; else p.y = g;
      }
      if (this.state === 'air') { this.vy -= GRAV * dt; p.y += this.vy * dt; const g2 = this.groundAt(p.x, p.z, p.y - this.vy * dt); if (p.y <= g2 && this.vy <= 0) { p.y = g2; this.vy = 0; this.state = 'ground'; if (this.jumped) G.shake(0.15); this.jumped = 0; } }
      // auto-climb by walking into a wall, or the Climb button near a wall
      const c = this.lastContact;
      if (c && mlen > 0.5 && mv.dot(c.n) < -0.55) { this.wallPush += dt; if (this.wallPush > 0.22) { this.wallPush = 0; this.startClimb(c.b, c.n); } } else this.wallPush = 0;
      if (inp.climb && this.state !== 'climb') { const w = c || this.nearWall(); if (w) this.startClimb(w.b, w.n); }
    }
    p.x = clamp(p.x, -HALF * 1.25, HALF * 1.25); p.z = clamp(p.z, -HALF * 1.25, HALF * 1.25);
    // punch impact
    if (this.punchT > 0) {
      this.punchT -= dt;
      if (!this.hitDone && this.punchT < 0.24) { this.hitDone = true; this.G.punchAt(this.fistPoint(), this.forward()); }
    }
    if (this.eatT > 0) this.eatT -= dt;
    this.animate(dt);
  }
  fistPoint() {
    const f = this.forward(), p = this.pos;
    if (this.state === 'climb') return new THREE.Vector3(p.x + f.x * (R + 2.0), p.y + 7.0, p.z + f.z * (R + 2.0));
    const onRoof = p.y > 1 && this.state === 'ground';
    return new THREE.Vector3(p.x + f.x * (R + 2.2), p.y + (onRoof ? 0.5 : 4), p.z + f.z * (R + 2.2));
  }
  animate(dt) {
    const m = this.m, t = performance.now() / 1000; this.walkT += dt * (this.moving > 0.1 ? 9 * this.moving : 0);
    m.root.position.copy(this.pos); m.root.rotation.y = this.facing;
    const s = Math.sin(this.walkT), mv = this.moving;
    let aL = -0.1, aR = -0.1, eL = -0.2, eR = -0.2, lL = 0, lR = 0, lean = 0.12, bob = 0;
    if (this.state === 'climb') {
      const c = Math.sin(this.walkT * 0.8); aL = -2.6 + c * 0.45; aR = -2.6 - c * 0.45; eL = -0.5; eR = -0.5; lL = -0.6 - c * 0.5; lR = -0.6 + c * 0.5; lean = 0.25;
    } else if (this.state === 'air') { aL = aR = -2.2; eL = eR = -0.6; lL = -0.7; lR = 0.4; }
    else { aL = -0.15 + s * 0.7 * mv; aR = -0.15 - s * 0.7 * mv; lL = -s * 0.7 * mv; lR = s * 0.7 * mv; bob = Math.abs(Math.cos(this.walkT)) * 0.35 * mv + Math.sin(t * 2) * 0.06; lean = 0.12 + 0.2 * mv; }
    if (this.held) { aL = aR = -2.95; eL = eR = -0.15; }
    if (this.eatT > 0) { const k = this.eatT; aR = -2.2; eR = -1.6; m.jaw.rotation.x = 0.55 * Math.min(1, Math.sin(Math.min(1, (1 - k / 1.0)) * Math.PI) * 1.5); m.mouth.visible = true; }
    else { m.jaw.rotation.x *= 0.8; m.mouth.visible = m.jaw.rotation.x > 0.05; }
    if (this.punchT > 0) {
      const k = 1 - this.punchT / 0.34, ext = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7; const down = this.state === 'ground' && this.pos.y > 1 ? -0.6 : 0;
      const ang = -1.55 - ext * 0.15 - down, e = -0.05 * ext - 0.9 * (1 - ext);
      if (this.punchArm) { aR = aR * (1 - ext) + ang * ext; eR = e; } else { aL = aL * (1 - ext) + ang * ext; eL = e; }
      lean += 0.25 * ext;
    }
    const L = (o, v) => o.rotation.x += (v - o.rotation.x) * Math.min(1, dt * 18);
    L(m.armL.sh, aL); L(m.armR.sh, aR); L(m.armL.el, eL); L(m.armR.el, eR); L(m.legL, lL); L(m.legR, lR);
    m.armL.sh.rotation.z = 0.12; m.armR.sh.rotation.z = -0.12;
    m.body.rotation.x += (lean - m.body.rotation.x) * Math.min(1, dt * 10); m.body.position.y = bob;
    m.head.rotation.y = Math.sin(t * 0.7) * 0.15;
    const f = this.flash > 0 ? (Math.sin(t * 60) > 0 ? 0.32 : 0.1) : 0;
    for (const mt of m.mats) mt.emissive.setRGB(f, f * 0.55, f * 0.2);
    const g = this.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.1); m.shadow.position.set(this.pos.x, g + 0.08, this.pos.z); m.shadow.visible = this.state !== 'climb';
    m.shadow.scale.setScalar(clamp(1 - (this.pos.y - g) * 0.03, 0.4, 1));
  }
}
