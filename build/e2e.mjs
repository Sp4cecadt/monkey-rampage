// End-to-end test for Monkey Rampage (desktop + iPhone landscape touch). BASE env selects local or live site.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:47631/monkey-rampage/';
const OUT = process.env.OUT || '/workspace/monkey_rampage/screens/';
const errs = [], res = [];
const ok = (c, m) => { res.push((c ? 'PASS ' : 'FAIL ') + m); console.log((c ? '✓ ' : '✗ ') + m); };
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
function watch(p, tag) {
  p.on('console', m => { if (m.type() === 'error') errs.push(`[${tag}] ${m.text()}`); });
  p.on('pageerror', e => errs.push(`[${tag}] pageerror ${e.message}`));
  p.on('response', r => { if (r.status() >= 400) errs.push(`[${tag}] http ${r.status()} ${r.url()}`); });
}
const E = (p, f, a) => p.evaluate(f, a);
// advance game time deterministically (software GPU in CI renders only a few fps), then let a frame render
const W = async (p, ms) => { await p.evaluate(ms => G.advance(ms / 1000), ms); await p.waitForTimeout(80); };
const shot = (p, n) => p.screenshot({ path: OUT + n });
const until = (p, f, a, t = 15000) => p.waitForFunction(f, a, { timeout: t, polling: 100 });

// helpers that run in the page
const SETUP = () => {
  const city = G.city;
  window.T = {
    sky: () => city.buildings.filter(b => b.kind === 'sky' && !b.dead && !b.collapsing).sort((a, c) => Math.hypot(a.cx, a.cz) - Math.hypot(c.cx, c.cz))[0],
    // a chunk on the +x face of building b with material m, not a corner, at least `minY` floors up
    chunkOn(b, m, minY = 2) { for (const i of b.ids) { if (!city.alive[i] || city.cm[i] !== m || city.cx[i] !== b.nx - 1) continue; if (city.cz[i] === 0 || city.cz[i] === b.nz - 1 || city.cy[i] < minY || city.cy[i] >= b.ny - 2) continue; return i; } return -1; },
    aimAt(i) { const b = city.buildings[city.cb[i]], u = (city.wz[i] - b.z0) / (b.z1 - b.z0); dbg.climbTo(b, '+x', city.wy[i] - 7, u); G.cam.pitch = 0.25; G.cam.dist = 26; G.cam.yaw = G.monkey.facing + Math.PI + 0.7; },
    // a face of b with open street in front of it (nothing within `d` units)
    openFace(b, d = 18) { const c = G.city; for (const f of ['+x', '-x', '+z', '-z']) { let clear = true; for (let k = 3; k <= d; k += 1.5) for (const u of [0.2, 0.5, 0.8]) { const x = f === '+x' ? b.x1 + k : f === '-x' ? b.x0 - k : b.x0 + (b.x1 - b.x0) * u, z = f === '+z' ? b.z1 + k : f === '-z' ? b.z0 - k : b.z0 + (b.z1 - b.z0) * u; if (c.buildingAt(x, 1, z, 1)) clear = false; } if (clear) return f; } return '+x'; },
    back(f, d) { const m = G.monkey.pos; if (f === '+x') m.x += d; if (f === '-x') m.x -= d; if (f === '+z') m.z += d; if (f === '-z') m.z -= d; },
    lookFrom(x, y, z, yaw, pitch, dist) { G.cam.yaw = yaw; G.cam.pitch = pitch; G.cam.dist = dist; },
  };
};

async function punchKey(p) { await p.keyboard.press('KeyF'); await W(p, 450); }

// ================= desktop =================
{
  const p = await (await b.newContext({ viewport: { width: 1366, height: 800 } })).newPage(); watch(p, 'desktop');
  await p.goto(BASE); await until(p, () => window.G && document.getElementById('loading').classList.contains('done'), null, 60000); await W(p, 1500);
  await E(p, SETUP);
  const info = await E(p, () => ({ chunks: G.city.N, buildings: G.city.buildings.length, cars: G.actors.cars.length, sky: G.city.buildings.filter(b => b.kind === 'sky').length }));
  ok(info.chunks > 3000 && info.buildings > 50, `city built: ${info.buildings} buildings (${info.sky} skyscrapers), ${info.chunks} chunks, ${info.cars} cars`);
  ok(await E(p, () => document.querySelectorAll('.card.locked').length === 4 && !!document.querySelector('.card.sel')), 'roster: monkey playable, 4 monsters locked "coming soon"');
  await shot(p, '01-roster.png');
  await p.click('#playBtn'); await W(p, 1200);
  ok(await E(p, () => G.started && !document.getElementById('hud').hidden), 'game started, HUD visible');
  await shot(p, '02-start.png');
  // cars drive
  const c0 = await E(p, () => G.actors.cars.filter(c => c.state === 'drive').map(c => [c.mesh.position.x, c.mesh.position.z]));
  // walk
  const p0 = await E(p, () => G.monkey.pos.toArray());
  await p.keyboard.down('KeyW'); await W(p, 1300); await p.keyboard.up('KeyW');
  const p1 = await E(p, () => G.monkey.pos.toArray());
  ok(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 5, `monkey walks with W: moved ${Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(1)} units`);
  const c1 = await E(p, () => G.actors.cars.filter(c => c.state === 'drive').map(c => [c.mesh.position.x, c.mesh.position.z]));
  const moved = c1.filter((c, i) => c0[i] && Math.hypot(c[0] - c0[i][0], c[1] - c0[i][1]) > 1).length;
  ok(moved >= 5, `traffic moving: ${moved} cars changed position`);
  await shot(p, '03-walk-traffic.png');

  // climb: walk into a skyscraper wall
  await E(p, () => { const b = T.sky(); window.SKY = b.id; dbg.face(b, '+x', 0, 0.5); G.monkey.pos.x += 3; G.cam.pitch = 0.3; });
  await p.keyboard.down('KeyW'); await W(p, 2600); await p.keyboard.up('KeyW');
  const cl = await E(p, () => ({ st: G.monkey.state, y: G.monkey.pos.y }));
  ok(cl.st === 'climb' && cl.y > 4, `walked into wall → climbing, now ${cl.y.toFixed(1)} units up`);
  await E(p, () => { G.cam.yaw += 0.8; G.cam.pitch = 0.2; }); await W(p, 400);
  await shot(p, '04-climbing.png');
  // lateral climbing + wrap around the corner
  await p.keyboard.down('KeyD'); await W(p, 1500); await p.keyboard.up('KeyD');
  ok(await E(p, () => G.monkey.state === 'climb'), 'climbs sideways along the wall (A/D)');

  // glass: 1 hit
  const g = await E(p, () => { const b = G.city.buildings[SKY], i = T.chunkOn(b, 0, 2); T.aimAt(i); return { i, hp: G.city.hp[i] }; });
  await W(p, 300); await punchKey(p);
  const gAlive = await E(p, i => G.city.alive[i], g.i);
  ok(g.i >= 0 && gAlive === 0, `glass chunk shattered in 1 punch (hp ${g.hp})`);
  await W(p, 150); await shot(p, '05-glass-one-punch.png');
  // concrete: several hits
  const cc = await E(p, () => { const b = G.city.buildings[SKY]; let i = -1; for (const k of b.ids) if (G.city.alive[k] && G.city.cm[k] === 2 && G.city.cx[k] === b.nx - 1 && G.city.cz[k] > 0 && G.city.cz[k] < b.nz - 1 && G.city.cy[k] >= 5 && G.city.cy[k] < b.ny - 1) { i = k; break; } T.aimAt(i); return { i, hp: G.city.hp[i] }; });
  await W(p, 300); let hits = 0, aliveAfter1 = null;
  for (let k = 0; k < 10; k++) { await punchKey(p); hits++; const a = await E(p, i => G.city.alive[i], cc.i); if (k === 0) { aliveAfter1 = a; await shot(p, '06-concrete-cracked.png'); } if (!a) break; }
  ok(cc.i >= 0 && aliveAfter1 === 1 && hits > 1, `concrete chunk survived 1st punch (cracked) and broke after ${hits} punches (hp ${cc.hp})`);

  // roof: climb to the top and stand on it
  await E(p, () => { const b = G.city.buildings[SKY]; dbg.climbTo(b, '+x', b.h - 7, 0.5); });
  await p.keyboard.down('KeyW'); for (let k = 0; k < 12 && (await E(p, () => G.monkey.state)) !== 'ground'; k++) await W(p, 250); await p.keyboard.up('KeyW');
  const rf = await E(p, () => ({ st: G.monkey.state, y: G.monkey.pos.y, h: G.city.buildings[SKY].h }));
  ok(rf.st === 'ground' && Math.abs(rf.y - rf.h) < 0.6, `mantled onto the roof at ${rf.y.toFixed(0)} units (roof ${rf.h}, state ${rf.st})`);
  await E(p, () => { G.cam.pitch = 0.5; G.cam.dist = 40; }); await W(p, 500); await shot(p, '07-on-the-roof.png');

  // collapse: punch out the base of a brick/concrete building
  const target = await E(p, () => { const m = G.monkey.pos; const list = G.city.buildings.filter(b => b.kind !== 'sky' && !b.dead && !b.collapsing && b.ny >= 3 && b.ny <= 9).sort((a, c) => Math.hypot(a.cx - m.x, a.cz - m.z) - Math.hypot(c.cx - m.x, c.cz - m.z)); window.TB = list[0]; return { id: list[0].id, kind: list[0].kind, nx: list[0].nx, nz: list[0].nz, ny: list[0].ny }; });
  let collapsed = false, punches = 0;
  outer: for (const face of ['+x', '-z', '-x', '+z']) for (const u of [0.12, 0.38, 0.62, 0.88]) {
    await E(p, ([f, u]) => { dbg.face(TB, f, 0, u); G.cam.pitch = 0.35; G.cam.dist = 34; G.cam.yaw = G.monkey.facing + Math.PI + 0.9; }, [face, u]);
    for (let k = 0; k < 5; k++) { await p.keyboard.press('KeyF'); await W(p, 330); punches++; if (await E(p, () => TB.collapsing || TB.dead)) { collapsed = true; break outer; } }
  }
  ok(collapsed, `building ${target.id} (${target.kind}, ${target.nx}x${target.nz}x${target.ny}) collapsed after ${punches} punches at its base`);
  await E(p, () => { const f = T.openFace(TB, 30); dbg.face(TB, f, 0, 0.5); T.back(f, 16); G.cam.yaw = G.monkey.facing + Math.PI + 0.4; G.cam.dist = 48; G.cam.pitch = 0.35; G.cam.tgt.copy(G.monkey.pos); });
  await W(p, 700); await shot(p, '08-collapse-dust.png');
  await W(p, 9000); await until(p, () => TB.dead, null, 20000); ok(true, 'collapsed building sank into rubble');

  // fire + smoke
  const fb = await E(p, () => { const m = G.monkey.pos; const b = G.city.buildings.filter(b => !b.dead && !b.collapsing && b.h > 20).sort((a, c) => Math.hypot(a.cx - m.x, a.cz - m.z) - Math.hypot(c.cx - m.x, c.cz - m.z))[0]; window.FB = b; for (let k = 0; k < 3; k++) G.city.igniteBuilding(b); dbg.face(b, '+x', 0, 0.5); G.monkey.pos.x += 22; G.cam.yaw = Math.PI / 2 + 0.5; G.cam.pitch = 0.25; G.cam.dist = 45; return b.id; });
  await W(p, 3500);
  const fs = await E(p, () => ({ fires: G.city.fires.length, smoke: G.smoke.live, flame: G.fire.live }));
  ok(fs.fires > 0 && fs.smoke > 20 && fs.flame > 20, `fire burning: ${fs.fires} fires, ${fs.flame} flame + ${fs.smoke} smoke particles`);
  await shot(p, '09-fire-smoke.png');
  ok(await E(p, () => { const t = G.city.fireTimer; return t > 0 && t < 20; }), 'random fire timer running (fires start by themselves, more often on damaged buildings)');

  // grab a car
  const car = await E(p, () => {
    const m = G.monkey; const cs = G.actors.cars.filter(c => c.state === 'drive' && c.kind !== 'bus'); const c = cs.sort((a, b) => Math.hypot(a.mesh.position.x - m.pos.x, a.mesh.position.z - m.pos.z) - Math.hypot(b.mesh.position.x - m.pos.x, b.mesh.position.z - m.pos.z))[0];
    c.cruise = 0; c.speed = 0; const cp = c.mesh.position; const dx = c.dx || 0, dz = c.dz || 0;
    m.state = 'ground'; m.climb = null; m.pos.set(cp.x + dz * 4.5, 0, cp.z - dx * 4.5); // beside the car
    m.facing = Math.atan2(cp.x - m.pos.x, cp.z - m.pos.z); G.cam.yaw = m.facing + Math.PI + 0.6; G.cam.pitch = 0.3; G.cam.dist = 30; G.cam.tgt.copy(m.pos); window.CAR = c; return c.kind;
  });
  await p.keyboard.press('KeyG'); await W(p, 600);
  ok(await E(p, () => G.monkey.held && G.monkey.held.type === 'car' && CAR.state === 'held'), `G grabbed a ${car}`);
  await shot(p, '10-car-grabbed.png');
  // aim at an office/skyscraper wall and throw
  const before = await E(p, () => {
    const m = G.monkey; const b = G.city.buildings.filter(b => !b.dead && !b.collapsing && b.h >= 24).sort((a, c) => Math.hypot(a.cx - m.pos.x, a.cz - m.pos.z) - Math.hypot(c.cx - m.pos.x, c.cz - m.pos.z))[0]; window.THB = b;
    const f = T.openFace(b); dbg.face(b, f, 0, 0.5); T.back(f, 14); G.cam.yaw = m.facing + Math.PI; G.cam.pitch = 0.22; G.cam.dist = 30; G.cam.tgt.copy(m.pos);
    return { destroyed: G.city.destroyed, hpSum: b.ids.reduce((s, i) => s + Math.max(0, G.city.hp[i]), 0), wrecked: G.stats.cars };
  });
  await W(p, 300); await p.keyboard.press('KeyG'); await W(p, 160); await shot(p, '11-car-thrown.png');
  await W(p, 500); await shot(p, '12-car-hits-building.png');
  const after = await E(p, () => ({ destroyed: G.city.destroyed, hpSum: THB.ids.reduce((s, i) => s + Math.max(0, G.city.hp[i]), 0), wrecked: CAR.wrecked, st: CAR.state }));
  ok(after.hpSum < before.hpSum - 2 && after.wrecked, `thrown car smashed into the building: ${after.destroyed - before.destroyed} chunks broke, building lost ${(before.hpSum - after.hpSum).toFixed(1)} HP, car wrecked (${after.st})`);
  // punch a car
  const pc = await E(p, () => { const m = G.monkey; m.state = 'ground'; m.climb = null; const c = G.actors.cars.filter(c => c.state === 'drive' && !c.wrecked && c.kind !== 'bus' && c.kind !== 'tank')[0]; c.cruise = c.speed = 0; const cp = c.mesh.position; m.pos.set(cp.x + (c.dz || 0) * 4.6, 0, cp.z - (c.dx || 0) * 4.6); m.facing = Math.atan2(cp.x - m.pos.x, cp.z - m.pos.z); window.PC = c; return true; });
  await p.keyboard.press('KeyF'); await W(p, 500);
  ok(await E(p, () => PC.wrecked), 'punching a car wrecks it and sends it flying');

  // police / army men: they shoot, the monkey eats them
  const h0 = await E(p, () => { const m = G.monkey; m.pos.set(G.city.parks[0].x0 + 22, 0, G.city.parks[0].z0 + 22); m.state = 'ground'; const s = G.actors.spawnPerson(true), c = G.actors.spawnPerson(false); s.mesh.position.set(m.pos.x + 12, 0, m.pos.z + 3); c.mesh.position.set(m.pos.x + 10, 0, m.pos.z - 6); s.dist = 12; c.dist = 11; s.cd = 0.2; c.cd = 0.3; s.ang = Math.atan2(3, 12); c.ang = Math.atan2(-6, 10); window.SOL = s; m.facing = Math.PI / 2; G.cam.yaw = -Math.PI / 2 + 0.3 + Math.PI; G.cam.yaw = m.facing + Math.PI - 0.5; G.cam.pitch = 0.28; G.cam.dist = 28; return G.hitsTaken; });
  await W(p, 1800); await shot(p, '13-soldiers-shooting.png');
  const h1 = await E(p, () => G.hitsTaken);
  ok(h1 > h0, `police & army men shoot at the monkey (hits taken ${h0} → ${h1}, he stays indestructible)`);
  await E(p, () => { const m = G.monkey, sp = SOL.mesh.position; SOL.dist = 4; m.pos.set(sp.x - 4, 0, sp.z); m.facing = Math.PI / 2; });
  await p.keyboard.press('KeyG'); await W(p, 450); await shot(p, '14-gulp.png');
  await W(p, 1000);
  ok(await E(p, () => G.stats.eaten >= 1 && !G.actors.people.includes(SOL)), 'grabbed an army man and ate him (GULP)');

  // helicopter
  await E(p, () => { const m = G.monkey; const h = G.actors.spawnHeli(); h.state = 'circle'; h.anchor.copy(m.pos); h.ang = 0; h.g.position.set(m.pos.x + 16, 34, m.pos.z); h.shootCd = 0.1; G.cam.pitch = 0.05; G.cam.dist = 40; G.cam.yaw = Math.PI / 2 + 0.4; });
  const hh0 = await E(p, () => G.hitsTaken);
  await W(p, 2200); await shot(p, '15-helicopter-attack.png');
  const hh1 = await E(p, () => ({ hits: G.hitsTaken, tr: G.tracers.active, st: G.actors.heli && G.actors.heli.state }));
  ok(hh1.hits > hh0, `army helicopter circles and shoots (hits ${hh0} → ${hh1.hits}, state ${hh1.st})`);
  // dive + jump + grab
  await W(p, 1200); await E(p, () => { if (G.monkey.held && G.monkey.held.type === 'person') G.monkey.held = null; for (const q of G.actors.people) G.scene.remove(q.mesh); G.actors.people.length = 0; G.actors.peopleTimer = 99; });
  await E(p, () => { const m = G.monkey, h = G.actors.heli; h.state = 'dive'; h.dive = 9; h.anchor.copy(m.pos); h.ang = 0; h.g.position.set(m.pos.x + 10, 20, m.pos.z); m.facing = Math.PI / 2; G.cam.yaw = Math.PI / 2 + Math.PI - 0.6; G.cam.pitch = 0.15; G.cam.dist = 34; });
  await W(p, 600);
  const dv = await E(p, () => { const h = G.actors.heli.g.position, m = G.monkey; return { hy: h.y, hand: m.handPos().y, d: Math.hypot(h.x - m.pos.x, h.z - m.pos.z) }; });
  await p.keyboard.press('KeyG'); await W(p, 100);
  const noReach = await E(p, () => !(G.monkey.held && G.monkey.held.type === 'heli'));
  await p.keyboard.press('Space'); await W(p, 420); await p.keyboard.press('KeyG'); await W(p, 300);
  const gotHeli = await E(p, () => G.monkey.held && G.monkey.held.type === 'heli');
  ok(noReach && gotHeli, `diving chopper out of reach from the ground (heli y ${dv.hy.toFixed(1)}, hand ${dv.hand.toFixed(1)}), jump + grab caught it`);
  await W(p, 500); await shot(p, '16-helicopter-grabbed.png');
  const sc0 = await E(p, () => G.score);
  await p.keyboard.press('KeyF'); await W(p, 350); await shot(p, '17-helicopter-crushed-explosion.png');
  await W(p, 300);
  const hd = await E(p, () => ({ helis: G.stats.helis, gone: !G.actors.heli, score: G.score }));
  ok(hd.helis === 1 && hd.gone && hd.score - sc0 >= 5000, `crushed the chopper: explosion, +${hd.score - sc0} points`);
  // second chopper thrown into a building
  await E(p, () => { const m = G.monkey; const b = G.city.buildings.filter(b => !b.dead && !b.collapsing && b.h >= 24).sort((a, c) => Math.hypot(a.cx - m.pos.x, a.cz - m.pos.z) - Math.hypot(c.cx - m.pos.x, c.cz - m.pos.z))[0]; window.HB = b; const f = T.openFace(b); dbg.face(b, f, 0, 0.5); T.back(f, 14); const h = G.actors.spawnHeli(); h.state = 'held'; m.held = { type: 'heli', o: h }; G.cam.yaw = m.facing + Math.PI; G.cam.pitch = 0.25; G.cam.dist = 34; window.HB0 = G.city.destroyed; });
  await W(p, 300); await p.keyboard.press('KeyG'); await W(p, 700); await shot(p, '18-helicopter-thrown-into-building.png');
  ok(await E(p, () => G.stats.helis === 2 && G.city.destroyed > HB0), 'threw a chopper into a building: crash, explosion, chunks destroyed');

  // tanks: roll in, swivel turret, fire shells; punch 3x to destroy; grab + throw
  const tk = await E(p, () => {
    G.actors.peopleTimer = 99; const c = G.actors.spawnTank(true); window.TK = c; c.shootCd = 0.5; const m = G.monkey; m.state = 'ground'; m.climb = null; m.held = null;
    const tp = c.mesh.position; m.pos.set(tp.x + (c.dx || 0) * 32, 0, tp.z + (c.dz || 0) * 32); m.facing = Math.atan2(tp.x - m.pos.x, tp.z - m.pos.z);
    G.cam.yaw = m.facing + Math.PI + 1.1; G.cam.pitch = 0.3; G.cam.dist = 42; G.cam.tgt.copy(m.pos); return G.hitsTaken;
  });
  await W(p, 2500); await shot(p, '19-tank-firing.png'); await W(p, 2500);
  const tk1 = await E(p, () => ({ hits: G.hitsTaken, st: TK.state, kind: TK.kind }));
  ok(tk1.kind === 'tank' && tk1.st === 'drive' && tk1.hits > tk, `army tank rolls in and fires shells at the monkey (hits ${tk} → ${tk1.hits})`);
  await E(p, () => { const m = G.monkey, tp = TK.mesh.position; m.pos.set(tp.x + (TK.dz || 0) * 5.2, 0, tp.z - (TK.dx || 0) * 5.2); m.facing = Math.atan2(tp.x - m.pos.x, tp.z - m.pos.z); G.cam.yaw = m.facing + Math.PI + 1.3; G.cam.dist = 34; G.cam.tgt.copy(m.pos); });
  let tp1 = 0; for (let k = 0; k < 6 && !(await E(p, () => TK.wrecked)); k++) { await E(p, () => { const m = G.monkey, tp = TK.mesh.position; m.facing = Math.atan2(tp.x - m.pos.x, tp.z - m.pos.z); }); await punchKey(p); tp1++; }
  await shot(p, '20-tank-destroyed.png');
  ok(await E(p, () => TK.wrecked && G.stats.tanks === 1), `punched a tank ${tp1} times: it blew up (+1500)`);
  const tk2 = await E(p, () => { const c = G.actors.spawnTank(true); window.TK2 = c; c.shootCd = 99; const m = G.monkey, tp = c.mesh.position; m.pos.set(tp.x + (c.dz || 0) * 5.2, 0, tp.z - (c.dx || 0) * 5.2); m.facing = Math.atan2(tp.x - m.pos.x, tp.z - m.pos.z); G.cam.tgt.copy(m.pos); return true; });
  await p.keyboard.press('KeyG'); await W(p, 400);
  ok(await E(p, () => TK2.state === 'held'), 'grabbed a tank');
  await E(p, () => { const m = G.monkey; const b = G.city.buildings.filter(b => !b.dead && !b.collapsing && b.h >= 20).sort((a, c) => Math.hypot(a.cx - m.pos.x, a.cz - m.pos.z) - Math.hypot(c.cx - m.pos.x, c.cz - m.pos.z))[0]; window.TB2 = b; const f = T.openFace(b); dbg.face(b, f, 0, 0.5); T.back(f, 14); G.cam.yaw = m.facing + Math.PI + 0.7; G.cam.pitch = 0.25; G.cam.dist = 38; window.TB20 = b.ids.reduce((s, i) => s + Math.max(0, G.city.hp[i]), 0); });
  await W(p, 300); await shot(p, '21-tank-held.png'); await E(p, () => { G.cam.yaw = G.monkey.facing + Math.PI; }); await W(p, 100); await p.keyboard.press('KeyG'); await W(p, 650); await shot(p, '22-tank-thrown-into-building.png');
  ok(await E(p, () => TK2.wrecked && TB2.ids.reduce((s, i) => s + Math.max(0, G.city.hp[i]), 0) < TB20 - 3), 'threw the tank into a building: big damage, tank wrecked');
  // pause
  await p.keyboard.press('KeyP'); await W(p, 300); ok(await E(p, () => G.paused && !document.getElementById('pause').hidden), 'P pauses'); await shot(p, '23-paused.png');
  await p.keyboard.press('KeyP');
  // win: level the city
  await E(p, () => { for (const b of G.city.buildings) if (!b.dead && G.destroyedFrac() < 0.72) G.city.collapse(b); });
  await W(p, 12000); await until(p, () => G.won, null, 40000); await W(p, 400);
  ok(await E(p, () => !document.getElementById('win').hidden), 'win screen when 70% of the city is levelled');
  await shot(p, '24-win.png');
  const perf = await E(p, () => G.fps); console.log('desktop swiftshader fps', perf.toFixed(1));
  await p.close();
}

// ================= iPhone landscape (touch) =================
{
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const p = await ctx.newPage(); watch(p, 'iphone'); const cdp = await ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await p.goto(BASE); await until(p, () => window.G && document.getElementById('loading').classList.contains('done'), null, 60000); await W(p, 1500);
  await E(p, SETUP);
  await shot(p, '30-phone-roster.png');
  await p.tap('#playBtn'); await W(p, 1000);
  ok(await E(p, () => !document.getElementById('touch').hidden && getComputedStyle(document.getElementById('bPunch')).display !== 'none'), 'phone: touch joystick + Punch/Jump/Grab/Climb buttons shown');
  await shot(p, '31-phone-start.png');
  const p0 = await E(p, () => G.monkey.pos.toArray());
  await touch('touchStart', [{ x: 110, y: 300, id: 1 }]); for (let k = 1; k <= 6; k++) { await touch('touchMove', [{ x: 110, y: 300 - k * 10, id: 1 }]); await W(p, 30); }
  await W(p, 1200); await shot(p, '32-phone-joystick.png'); await touch('touchEnd', []);
  const p1 = await E(p, () => G.monkey.pos.toArray());
  ok(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 5, `phone: joystick moves the monkey ${Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(1)} units`);
  // camera drag on right side
  const y0 = await E(p, () => G.cam.yaw);
  await touch('touchStart', [{ x: 500, y: 150, id: 2 }]); for (let k = 1; k <= 5; k++) { await touch('touchMove', [{ x: 500 + k * 20, y: 150, id: 2 }]); await W(p, 20); } await touch('touchEnd', []);
  ok(Math.abs(await E(p, () => G.cam.yaw) - y0) > 0.2, 'phone: dragging the screen orbits the camera');
  // climb button + punch glass
  const g = await E(p, () => { const b = T.sky(); const i = T.chunkOn(b, 0, 3); T.aimAt(i); return i; });
  await W(p, 300); await p.tap('#bPunch'); await W(p, 500);
  ok(await E(p, i => G.city.alive[i] === 0, g), 'phone: Punch button shatters glass in one hit');
  await shot(p, '33-phone-climb-punch.png');
  await p.tap('#bClimb'); await W(p, 800);
  ok(await E(p, () => G.monkey.state !== 'climb'), 'phone: Climb button lets go of the wall');
  // grab + throw a car with buttons
  await E(p, () => { const m = G.monkey; const c = G.actors.cars.filter(c => c.state === 'drive' && c.kind !== 'bus')[0]; c.cruise = c.speed = 0; const cp = c.mesh.position; m.state = 'ground'; m.climb = null; m.pos.set(cp.x + (c.dz || 0) * 4.5, 0, cp.z - (c.dx || 0) * 4.5); m.facing = Math.atan2(cp.x - m.pos.x, cp.z - m.pos.z); window.PCAR = c; G.cam.yaw = m.facing + Math.PI + 0.5; G.cam.tgt.copy(m.pos); });
  await p.tap('#bGrab'); await W(p, 500);
  ok(await E(p, () => PCAR.state === 'held'), 'phone: Grab button picks up a car');
  await shot(p, '34-phone-car-held.png');
  await E(p, () => { const m = G.monkey; const b = G.city.buildings.filter(b => !b.dead && !b.collapsing && b.h >= 20).sort((a, c) => Math.hypot(a.cx - m.pos.x, a.cz - m.pos.z) - Math.hypot(c.cx - m.pos.x, c.cz - m.pos.z))[0]; window.PB = b; const f = T.openFace(b); dbg.face(b, f, 0, 0.5); T.back(f, 14); G.cam.yaw = m.facing + Math.PI; G.cam.pitch = 0.25; G.cam.tgt.copy(m.pos); window.PB0 = b.ids.reduce((s, i) => s + Math.max(0, G.city.hp[i]), 0); });
  await W(p, 300); await p.tap('#bGrab'); await W(p, 700);
  ok(await E(p, () => PCAR.wrecked && PB.ids.reduce((s, i) => s + Math.max(0, G.city.hp[i]), 0) < PB0), 'phone: Grab again throws the car into the building');
  await shot(p, '35-phone-car-impact.png');
  // chopper + fire on the phone
  await E(p, () => { const m = G.monkey; const h = G.actors.spawnHeli(); h.state = 'circle'; h.anchor.copy(m.pos); h.g.position.set(m.pos.x + 16, 34, m.pos.z); h.shootCd = 0.1; G.city.igniteBuilding(PB); G.city.igniteBuilding(PB); G.cam.pitch = 0.12; G.cam.dist = 40; });
  await W(p, 2500); await shot(p, '36-phone-helicopter-fire.png');
  ok(await E(p, () => G.hitsTaken > 0), 'phone: helicopter attack registers hits');
  await p.tap('#pauseBtn'); await W(p, 300); await shot(p, '37-phone-paused.png');
  ok(await E(p, () => G.paused), 'phone: pause button');
  console.log('phone swiftshader fps', (await E(p, () => G.fps)).toFixed(1));
  await p.close();
}
await b.close();
ok(errs.length === 0, 'no console errors / failed requests' + (errs.length ? ': ' + errs.slice(0, 8).join(' | ') : ''));
const fails = res.filter(r => r.startsWith('FAIL')); console.log(`\n${res.length - fails.length}/${res.length} passed`); process.exit(fails.length ? 1 : 0);
