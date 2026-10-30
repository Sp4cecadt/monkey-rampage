# Monkey Rampage 🦍🏙️

A cartoon 3D city-smashing browser game. Play as **Bananas**, a giant indestructible monkey, and level a toy city of
skyscrapers and little windowed buildings — punch through walls, climb towers, throw cars, eat cops and swat army choppers.

**Play:** https://sp4cecadt.github.io/monkey-rampage/ (works on desktop and iPhone; Share → Add to Home Screen to install)

## Controls
| | Desktop | iPhone (landscape) |
|---|---|---|
| Move | WASD / arrows | left-thumb joystick |
| Camera | drag mouse, wheel to zoom | drag right side, pinch to zoom |
| Punch | click or F (hold to keep punching) | Punch button (hold) |
| Jump | Space | Jump button |
| Grab / throw | G (grab car, soldier or chopper; G again throws where the camera looks; punch while holding crushes) | Grab button |
| Climb | walk into a wall (C/E lets go) | walk into a wall / Climb button |
| Pause | P or Esc (R restarts while paused) | ⏸ button |

## v1 features
- Procedural cartoon city (5×5 blocks, central park): glass skyscrapers with concrete bands, concrete offices, brick shops — all with windows — plus roads, crossings, trees, lamps and traffic.
- Chunk destruction: 7,000+ chunks. Glass breaks in 1 hit, brick in ~3, concrete in ~5. Damaged chunks crack and darken; unsupported chunks fall; buildings collapse with dust when their base is gone.
- Fires start randomly (more often on damaged buildings), spread, and weaken burning chunks; flames and smoke plumes.
- Traffic drives in lanes, queues, flees, U-turns and freezes in terror. Grab and throw cars (damage scales with speed), punch them to wreck them; wrecks burn and can explode.
- Police and army men run in and shoot (cosmetic hits counter); grab one to eat him (cartoon gulp).
- Army helicopter every 45–90 s (sooner as destruction rises): circles, dives and fires tracers. Grab it from a roof, while climbing high, or with jump + grab, then crush it or throw it into a building (+5000).
- HUD with score, combo multiplier, % destroyed, timer, hits taken; win screen at 70% destroyed; pause/restart; low-graphics toggle; installable PWA.

## Dev
`node build/serve.mjs` (http://localhost:47631/monkey-rampage/), `node build/e2e.mjs` (playwright, desktop + iPhone), `build/deploy_github_pages.sh --bump`.
Three.js r169 is vendored in `vendor/`. Screenshots from the automated test are in `screens/`.
