# Snakes vs. Moles

A singleplayer, top-down browser survival game. The name is provisional.

## Run

```sh
npm install
npm run dev
```

Open the URL printed by Vite. Use a desktop browser with a mouse.

- **Mouse:** move the pointer over the field to guide the head. The snake follows the cursor's screen position as the field scrolls right. Arrow keys and WASD do not steer.
- **Mouse drag:** click and hold any head, body, or tail segment to pull it freely. Dragging takes priority over head steering. The body can cross itself without damage; rocks and emerged moles remain dangerous.
- **P / Escape:** pause and resume. Switching away pauses automatically.
- Touch peach-colored food with any segment to collect it. Each pickup adds a segment on the next movement or successful pull. Survive for the highest time.
- Moles spawn every second, accelerating to every half-second after 75 seconds survived. They blink for three seconds before emerging permanently. Warnings that leave view are canceled; offscreen body segments are safe from mole damage.
- Moles, hitting rocks, and letting the head fall out of view cost 1 of 10 HP, with one second of immunity after a hit.

## Checks

```sh
npm test
npm run build
```

Browser checks: run `npx playwright install chromium` once, then `npm run test:browser`.

`npm run preview` serves the production build. Build output is in `dist/` and can be hosted as a static site. No server, account, or API key is needed. The personal best is saved in browser storage when available.

The snake uses continuous floating-point positions, mouse steering, and a connected rope body. Physical substeps run at 120 Hz, with mouse-follow movement at up to four world units per second. Food and hazard contacts use distance to the body, and swept terrain checks prevent fast pulls through rocks. The camera scrolls continuously right at two world units per second, independently of the snake; steering and dragging keep the head within the moving view. Terrain is deterministically generated in 32-cell chunks with denser L-shaped obstacle islands and connected open lanes. Visited world state is retained for the current run. Very long sessions will therefore gradually use more memory.

Core modules: `game.ts` owns the simulation, `world.ts` generates terrain, `drag.ts` solves connected body adjustments, `render.ts` draws the field, and `main.ts` connects input and interface state.
