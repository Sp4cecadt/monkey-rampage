// Monkey Rampage: bootstrap, game state, scoring, camera, input, HUD.
import * as THREE from '../vendor/three.module.min.js';
import { City, MATS, HALF } from './city.js';
import { Monkey } from './monkey.js';
import { Actors } from './actors.js';
import { Particles, Debris, Tracers, Popups, Sfx } from './fx.js';
import { rand, clamp } from './util.js';

const VERSION = 'v1';
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
let low = localStorage.getItem('mr-low') === '1';

const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: !low, powerPreference: 'high-performance' });
renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8fd3ff); scene.fog = new THREE.Fog(0xb5e3ff, 170, 560);
const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 1500);
scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x7f9a5a, 1.7));
const sun = new THREE.DirectionalLight(0xfff3dd, 2.4); sun.position.set(120, 200, 80); scene.add(sun);
const boomLight = new THREE.PointLight(0xffaa44, 0, 90, 1.2); scene.add(boomLight);

const G = window.G = {
  scene, camera, lowGfx: low, started: false, paused: false, won: false, time: 0, score: 0, combo: 0, lastHit: -9, hitsTaken: 0,
  stats: { collapsed: 0, cars: 0, eaten: 0, helis: 0, bonked: 0, tanks: 0 }, heliTimer: rand(45, 90), maxFires: low ? 10 : 24,
};
G.sfx = new Sfx();
G.smoke = new Particles(scene, 1800, false); G.fire = new Particles(scene, 1400, true);
G.debris = new Debris(scene, 260, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshToonMaterial({ color: 0xffffff }));
G.shards = new Debris(scene, 420, new THREE.TetrahedronGeometry(1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
G.tracers = new Tracers(scene, 60); G.pops = new Popups($('pops'));
function applyLow() {
  G.lowGfx = low; G.maxFires = low ? 10 : 24; renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio, 2));
  for (const p of [G.smoke, G.fire, G.debris, G.shards]) { p.limit = low ? Math.floor(p.cap / 2) : p.cap; p.next = 0; }
  resize();
}
G.destroyedFrac = () => G.city.destroyed / G.city.N;
G.dust = (x, y, z, n) => { for (let i = 0; i < n * (low ? 2 : 4); i++) G.smoke.emit(x + rand(-1.5, 1.5), y + rand(-1, 1), z + rand(-1.5, 1.5), rand(-3, 3), rand(0, 3), rand(-3, 3), rand(1.2, 2.4), 2.5, 7, 0.8, 0.75, 0.66, 0.8, 0.6, 1.2); };
G.smallDust = (x, y, z) => { for (let i = 0; i < 3; i++) G.smoke.emit(x + rand(-1, 1), y + rand(-1, 1), z + rand(-1, 1), rand(-2, 2), rand(0, 2), rand(-2, 2), 0.9, 1.5, 4, 0.82, 0.78, 0.7, 0.7, 0.5, 1); };
G.poof = p => { for (let i = 0; i < 10; i++) G.smoke.emit(p.x + rand(-0.6, 0.6), 0.8, p.z + rand(-0.6, 0.6), rand(-3, 3), rand(1, 4), rand(-3, 3), 0.8, 1.2, 3.5, 1, 1, 1, 0.9, 0, 2); };
let shakeA = 0; G.shake = a => { shakeA = Math.min(1.5, shakeA + a); };
G.toast = msg => { const t = $('toast'); t.textContent = msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); };

G.city = new City(G);
G.monkey = new Monkey(G); G.monkey.pos.set(HALF - 2 * 60 - 8 - 22 + 16, 0, 0); // middle of the park block
{ const p = G.city.parks[0]; G.monkey.pos.set(p.x0 + 22, 0, p.z0 + 22); G.monkey.facing = Math.PI * 0.75; }
G.actors = new Actors(G);

// ---------- scoring ----------
function addScore(base, pos, label, cls = '', combo = true) {
  const now = G.time;
  if (combo) { G.combo = now - G.lastHit < 2.5 ? G.combo + 1 : 1; G.lastHit = now; }
  const mult = combo ? Math.min(10, 1 + Math.floor((G.combo - 1) / 5)) : 1, pts = Math.round(base * mult);
  G.score += pts; if (pos) G.pops.add(label || ('+' + pts), pos, cls);
}
G.onChunk = (m, pos, cause) => { if (cause === 'fire' || cause === 'fall') return addScore(MATS[m].pts, cause === 'fire' ? null : null, '', '', false); addScore(MATS[m].pts, pos, '', m === 0 ? 'glass' : ''); };
G.onChunksGone = () => { };
G.onCollapse = b => { G.stats.collapsed++; const p = new THREE.Vector3(b.cx, Math.min(b.h, 30), b.cz); addScore(400 + b.total * 6, p, 'COLLAPSE! +' + (400 + b.total * 6), 'big'); G.dust(b.cx, 3, b.cz, 10); };
G.onWreck = c => { if (c.kind === 'tank') { G.stats.tanks++; addScore(1500, c.mesh.position.clone().setY(5), 'TANK DOWN! +1500', 'big'); return; } G.stats.cars++; addScore(150, c.mesh.position.clone().setY(3), 'CRUNCH! +150'); };
G.onCarImpact = () => { };
G.onCrush = () => { };
G.onEat = q => { G.stats.eaten++; G.sfx.play('gulp'); addScore(100, G.monkey.pos.clone().setY(G.monkey.pos.y + 12), 'GULP! +100', 'gulp'); };
G.onPersonBonk = q => { G.stats.bonked++; addScore(50, q.mesh.position.clone().setY(q.mesh.position.y + 3), 'BONK!'); };
G.onHeliDown = p => { G.stats.helis++; addScore(5000, p.clone().setY(p.y + 4), 'CHOPPER DOWN! +5000', 'big', false); G.toast('🚁💥 Chopper down! +5000'); };
G.monkeyHit = p => { G.hitsTaken++; G.monkey.flash = 0.12; G.shake(0.04); for (let i = 0; i < 4; i++) G.fire.emit(p.x, p.y, p.z, rand(-6, 6), rand(-2, 6), rand(-6, 6), 0.18, 1.4, 0.3, 1, 0.95, 0.6, 1); };
G.explode = (p, size) => {
  const n = Math.floor((low ? 14 : 34) * size);
  for (let i = 0; i < n; i++) { const yel = Math.random() < 0.5; G.fire.emit(p.x + rand(-1, 1) * size, p.y + rand(-1, 1) * size, p.z + rand(-1, 1) * size, rand(-9, 9) * size * 0.6, rand(-2, 10) * size * 0.6, rand(-9, 9) * size * 0.6, rand(0.4, 1.0), rand(3, 6) * Math.sqrt(size), 0.8, 1, yel ? 0.9 : 0.5, yel ? 0.35 : 0.1, 1, 2, 1.5); }
  for (let i = 0; i < n / 2; i++) { const g = rand(0.12, 0.3); G.smoke.emit(p.x + rand(-2, 2) * size, p.y + rand(0, 2) * size, p.z + rand(-2, 2) * size, rand(-4, 4), rand(2, 7), rand(-4, 4), rand(2.5, 5), 4 * size, 11 * size, g, g, g, 0.8, 0.8, 0.6); }
  for (let i = 0; i < 4 * size; i++) G.debris.spawn(p.x, p.y + 1, p.z, rand(-14, 14), rand(6, 18), rand(-14, 14), rand(0.4, 1.1), rand(0.2, 0.6), rand(0.4, 1.1), 0x333333, rand(2, 4));
  boomLight.position.copy(p).y += 3; boomLight.intensity = 260 * size;
  G.shake(0.35 * size); G.sfx.play('boom');
  G.city.damageSphere(p, 3 + 2.5 * size, 2 * size, null, Math.floor(6 * size), 'boom');
  G.actors.blast(p, 5 + 3 * size);
  if (Math.random() < 0.7) { const near = G.city.chunksNear(p, 4 + 3 * size)[0]; if (near) G.city.startFire(near[0]); }
};
G.punchAt = (fp, fwd) => {
  const mon = G.monkey;
  if (mon.held && mon.held.type !== 'person') { G.actors.crushHeld(mon); G.pops.add('CRUSH!', fp.clone().setY(fp.y + 8), 'big'); return; }
  const r = G.city.damageSphere(fp, 3.6, 1, fwd, 2, 'punch'), a = G.actors.punch(fp, fwd);
  if (r.hit || a) { G.sfx.play('punch'); G.shake(0.12); G.smallDust(fp.x, fp.y, fp.z); } else G.sfx.play('throw');
  G.lastPunch = { hit: r.hit, broken: r.broken, actors: a };
};
G.camForward = () => new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
G.grabAction = () => {
  const mon = G.monkey; if (mon.eatT > 0) return;
  if (mon.held) { if (mon.held.type === 'person') return; const d = G.camForward(); mon.facing = Math.atan2(d.x, d.z); G.actors.throwHeld(mon, d); G.pops.add('THROW!', mon.handPos(), ''); return; }
  const t = G.actors.findGrab(mon);
  if (!t) { G.pops.add('nothing to grab', mon.handPos(), 'small'); return; }
  mon.held = t; t.o.state = 'held'; G.sfx.play('grab');
  if (t.type === 'person') { mon.eatT = 1.0; t.o.mesh.rotation.set(0, 0, 0); }
  else if (t.type === 'heli') G.toast('Got the chopper! 👊 Punch to crush it, ✊ Grab to throw it');
  else G.toast('Car grabbed! ✊ Grab again to throw (aims where the camera looks), 👊 Punch to crush');
};

// ---------- camera ----------
const cam = G.cam = { yaw: Math.PI * 0.75 + Math.PI, pitch: 0.42, dist: isTouch ? 34 : 30, tgt: new THREE.Vector3() };
cam.yaw = G.monkey.facing + Math.PI;
function updateCamera(dt) {
  const t = performance.now() / 1000;
  if (!G.started) { // roster attract mode: slow orbit around the city centre
    const a = t * 0.06; camera.position.set(Math.sin(a) * 120, 75, Math.cos(a) * 120); camera.lookAt(G.monkey.pos.x, 10, G.monkey.pos.z); return;
  }
  const mp = G.monkey.pos, ty = mp.y + 7; cam.tgt.x += (mp.x - cam.tgt.x) * Math.min(1, dt * 10); cam.tgt.z += (mp.z - cam.tgt.z) * Math.min(1, dt * 10); cam.tgt.y += (ty - cam.tgt.y) * Math.min(1, dt * 6);
  // keep the camera out of buildings: first tilt it up over the obstacle, then pull it in if still blocked
  const blocked = (pt, dist) => { const cp = Math.cos(pt), sx = Math.sin(cam.yaw) * cp, sy = Math.sin(pt), sz = Math.cos(cam.yaw) * cp; for (let k = 1; k <= 16; k++) { const s = dist * k / 16; if (G.city.buildingAt(cam.tgt.x + sx * s, cam.tgt.y + sy * s, cam.tgt.z + sz * s, 1.5)) return s; } if (G.city.buildingAt(cam.tgt.x + sx * dist, cam.tgt.y + sy * dist - 6, cam.tgt.z + sz * dist, 1.5)) return dist; return 0; };
  let wantP = cam.pitch, want = cam.dist;
  if (blocked(cam.pitch, cam.dist)) { let okP = null; for (let pt = cam.pitch + 0.15; pt <= 1.25; pt += 0.15) if (!blocked(pt, cam.dist)) { okP = pt; break; } if (okP != null) wantP = okP; else { wantP = Math.min(1.25, cam.pitch + 0.5); const s = blocked(wantP, cam.dist); want = Math.max(11, s - cam.dist / 16 - 1); } }
  cam.curP = cam.curP == null ? wantP : cam.curP + (wantP - cam.curP) * Math.min(1, dt * (wantP > cam.curP ? 8 : 2.5));
  cam.cur = cam.cur == null ? want : want < cam.cur ? want : cam.cur + (want - cam.cur) * Math.min(1, dt * 3);
  if (blocked(cam.curP, cam.cur)) cam.cur = Math.max(11, Math.min(cam.cur, blocked(cam.curP, cam.cur) - 1.5));
  const cp = Math.cos(cam.curP), sx = Math.sin(cam.yaw) * cp, sy = Math.sin(cam.curP), sz = Math.cos(cam.yaw) * cp, d = cam.cur;
  camera.position.set(cam.tgt.x + sx * d, Math.max(2, cam.tgt.y + sy * d), cam.tgt.z + sz * d);
  camera.lookAt(cam.tgt);
  if (shakeA > 0.001) { camera.position.x += rand(-1, 1) * shakeA; camera.position.y += rand(-1, 1) * shakeA; camera.position.z += rand(-1, 1) * shakeA; }
  shakeA *= Math.pow(0.02, dt);
}

// ---------- input ----------
const keys = new Set(); const edge = { jump: 0, punch: 0, grab: 0, climb: 0 }; const joy = { x: 0, y: 0, id: null, ox: 0, oy: 0 }; let touchPunch = false;
const KEYMAP = { Space: 'jump', KeyF: 'punch', KeyG: 'grab', KeyC: 'climb', KeyE: 'climb' };
addEventListener('keydown', e => {
  G.sfx.unlock(); if (e.repeat) { if (e.code !== 'KeyF') return; }
  keys.add(e.code); if (KEYMAP[e.code] && !e.repeat) { edge[KEYMAP[e.code]] = 1; e.preventDefault(); }
  if ((e.code === 'KeyP' || e.code === 'Escape') && G.started && !G.won) setPause(!G.paused);
  if (e.code === 'KeyR' && G.paused) restart();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const canvas = $('c'); let drag = null; const ptrs = new Map();
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  G.sfx.unlock(); canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, btn: e.button, type: e.pointerType };
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; drag.pinch = Math.hypot(a.x - b.x, a.y - b.y); drag.d0 = cam.dist; }
});
canvas.addEventListener('pointermove', e => {
  const pp = ptrs.get(e.pointerId); if (!pp) return; const dx = e.clientX - pp.x, dy = e.clientY - pp.y; pp.x = e.clientX; pp.y = e.clientY;
  if (ptrs.size === 2 && drag && drag.pinch) { const [a, b] = [...ptrs.values()]; cam.dist = clamp(drag.d0 * drag.pinch / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 14, 70); return; }
  if (drag && drag.id === e.pointerId) { drag.moved += Math.abs(dx) + Math.abs(dy); if (drag.moved > 5 || drag.type !== 'mouse') { cam.yaw -= dx * 0.0055; cam.pitch = clamp(cam.pitch + dy * 0.004, 0.08, 1.35); } }
});
const pend = e => { ptrs.delete(e.pointerId); if (drag && drag.id === e.pointerId) { if (drag.type === 'mouse' && drag.moved <= 5 && drag.btn === 0 && G.started) edge.punch = 1; drag = null; } };
canvas.addEventListener('pointerup', pend); canvas.addEventListener('pointercancel', pend);
canvas.addEventListener('wheel', e => { cam.dist = clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 14, 70); e.preventDefault(); }, { passive: false });
// touch joystick
const jz = $('joyzone'), jb = $('joy'), kn = $('knob');
jz.addEventListener('pointerdown', e => { G.sfx.unlock(); joy.id = e.pointerId; jz.setPointerCapture(e.pointerId); joy.ox = e.clientX; joy.oy = e.clientY; jb.style.left = e.clientX + 'px'; jb.style.top = e.clientY + 'px'; jb.classList.add('on'); e.preventDefault(); });
jz.addEventListener('pointermove', e => { if (e.pointerId !== joy.id) return; let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const l = Math.hypot(dx, dy), m = 55; if (l > m) { dx *= m / l; dy *= m / l; } joy.x = dx / m; joy.y = -dy / m; kn.style.transform = `translate(${dx}px,${dy}px)`; });
const jend = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; kn.style.transform = ''; jb.classList.remove('on'); };
jz.addEventListener('pointerup', jend); jz.addEventListener('pointercancel', jend);
for (const [id, act] of [['bPunch', 'punch'], ['bJump', 'jump'], ['bGrab', 'grab'], ['bClimb', 'climb']]) {
  const b = $(id); b.addEventListener('pointerdown', e => { G.sfx.unlock(); edge[act] = 1; if (act === 'punch') touchPunch = true; b.classList.add('down'); e.preventDefault(); });
  const up = () => { if (act === 'punch') touchPunch = false; b.classList.remove('down'); }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
}
function readInput() {
  const k = c => keys.has(c) ? 1 : 0;
  let mx = k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft'), mz = k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown');
  if (joy.id !== null) { mx = joy.x; mz = joy.y; }
  if (G.forceInput) Object.assign(edge, G.forceInput.edge || {}), (mx = G.forceInput.mx ?? mx), (mz = G.forceInput.mz ?? mz);
  const inp = { mx, mz, jump: edge.jump, punch: edge.punch || keys.has('KeyF') || touchPunch, grab: edge.grab, climb: edge.climb };
  edge.jump = edge.punch = edge.grab = edge.climb = 0; if (G.forceInput) G.forceInput.edge = null;
  return inp;
}

// ---------- HUD & screens ----------
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function hud() {
  $('score').textContent = G.score.toLocaleString();
  const mult = Math.min(10, 1 + Math.floor((G.combo - 1) / 5)), live = G.time - G.lastHit < 2.5 && G.combo >= 3;
  $('combo').textContent = live ? `COMBO ${G.combo}${mult > 1 ? `  ×${mult}` : ''}` : ''; $('combo').classList.toggle('hot', live && mult > 1);
  const f = G.destroyedFrac() * 100; $('pctFill').style.width = Math.min(100, f / 0.7) + '%'; $('pctTxt').textContent = `${f.toFixed(1)}% destroyed · goal 70%`;
  $('timer').textContent = '⏱ ' + fmtT(G.time); $('hits').textContent = '🎯 ' + G.hitsTaken + ' hits taken';
  const h = G.monkey.held; $('heldTip').textContent = h ? (h.type === 'person' ? 'GULP…' : `Holding a ${h.type === 'heli' ? 'helicopter' : 'car'} — Grab = throw, Punch = crush`) : '';
}
function setPause(p) { G.paused = p; $('pause').hidden = !p; }
function restart() { sessionStorage.setItem('mr-autostart', '1'); location.reload(); }
function start() {
  G.sfx.unlock(); G.started = true; $('roster').hidden = true; $('hud').hidden = false; $('touch').hidden = !isTouch;
  cam.tgt.copy(G.monkey.pos); cam.yaw = G.monkey.facing + Math.PI; G.toast('Smash the city! Walk into a wall to climb.');
}
function win() {
  G.won = true; const s = G.stats;
  $('winStats').innerHTML = `<b>${G.score.toLocaleString()}</b> points in ${fmtT(G.time)}<br>${s.collapsed} buildings toppled · ${s.cars} cars wrecked · ${s.eaten} soldiers & cops eaten · ${s.tanks} tanks &amp; ${s.helis} choppers downed · ${G.hitsTaken} hits shrugged off`;
  $('win').hidden = false; $('touch').hidden = true;
}
$('playBtn').onclick = start; $('resumeBtn').onclick = () => setPause(false); $('restartBtn').onclick = restart; $('againBtn').onclick = restart;
$('rosterBtn').onclick = () => location.reload(); $('pauseBtn').onclick = () => setPause(true);
for (const id of ['lowGfx', 'lowGfx2']) { $(id).checked = low; $(id).onchange = e => { low = e.target.checked; localStorage.setItem('mr-low', low ? '1' : '0'); $('lowGfx').checked = $('lowGfx2').checked = low; applyLow(); }; }
$('soundBtn').onclick = () => { G.sfx.on = !G.sfx.on; $('soundBtn').textContent = G.sfx.on ? '🔊 Sound on' : '🔇 Sound off'; };
document.querySelectorAll('.card.locked').forEach(c => c.onclick = () => { c.classList.remove('nope'); void c.offsetWidth; c.classList.add('nope'); });
$('ver').textContent = VERSION;

function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.fov = w < h ? 70 : 55; camera.updateProjectionMatrix();
  const sc = renderer.getPixelRatio() * h / (2 * Math.tan(camera.fov * Math.PI / 360)); G.smoke.mat.uniforms.uScale.value = G.fire.mat.uniforms.uScale.value = sc;
}
addEventListener('resize', resize); resize(); applyLow();

// ---------- main loop ----------
let last = performance.now(), hudT = 0, frames = 0, fpsT = 0; G.fps = 0;
function sim(dt) {
  if (G.paused) return;
  const inp = readInput();
  if (G.started && !G.won) { G.time += dt; G.monkey.update(dt, inp, cam); } else G.monkey.animate(dt);
  G.city.update(dt); G.actors.update(dt);
  G.smoke.update(dt); G.fire.update(dt); G.debris.update(dt); G.shards.update(dt); G.tracers.update(dt);
  boomLight.intensity *= Math.pow(0.002, dt);
  for (const c of G.city.clouds) { c.position.x += dt * 2; if (c.position.x > HALF * 1.6) c.position.x = -HALF * 1.6; }
  if (G.started && !G.won && G.destroyedFrac() >= 0.7) win();
}
// advance the game by `sec` of game time without rendering (used by automated tests on slow software GPUs)
G.advance = sec => { for (let t = 0; t < sec - 1e-6; t += 1 / 30) { sim(1 / 30); updateCamera(1 / 30); } };
function loop(now) {
  requestAnimationFrame(loop);
  const real = (now - last) / 1000, dt = Math.min(0.05, real); last = now; frames++; fpsT += real; if (fpsT > 1) { G.fps = frames / fpsT; frames = 0; fpsT = 0; }
  sim(dt);
  updateCamera(dt); G.pops.update(dt, camera, innerWidth, innerHeight);
  hudT -= dt; if (hudT <= 0 && G.started) { hudT = 0.1; hud(); }
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
$('loading').textContent = 'City ready'; $('loading').classList.add('done');
if (sessionStorage.getItem('mr-autostart') === '1' || params.has('play')) { sessionStorage.removeItem('mr-autostart'); start(); }
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');

// test/debug hooks
window.dbg = {
  G, cam, THREE, start, setPause,
  face(b, n, y = 0, u = 0.5) { const m = G.monkey; m.state = 'ground'; m.climb = null; m.held = m.held; const p = m.pos; if (n === '+x') p.set(b.x1 + 2.4, y, b.z0 + (b.z1 - b.z0) * u); if (n === '-x') p.set(b.x0 - 2.4, y, b.z0 + (b.z1 - b.z0) * u); if (n === '+z') p.set(b.x0 + (b.x1 - b.x0) * u, y, b.z1 + 2.4); if (n === '-z') p.set(b.x0 + (b.x1 - b.x0) * u, y, b.z0 - 2.4); const d = { '+x': [-1, 0], '-x': [1, 0], '+z': [0, -1], '-z': [0, 1] }[n]; m.facing = Math.atan2(d[0], d[1]); cam.yaw = m.facing + Math.PI; cam.tgt.copy(p); },
  climbTo(b, n, y, u = 0.5) { this.face(b, n, 0, u); const m = G.monkey; const nv = { '+x': [1, 0, 0], '-x': [-1, 0, 0], '+z': [0, 0, 1], '-z': [0, 0, -1] }[n]; m.startClimb(b, new THREE.Vector3(...nv)); m.pos.y = y; cam.tgt.copy(m.pos); },
};
