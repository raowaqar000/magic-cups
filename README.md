# Magic Cups

Cup-shuffle "follow the ball" game. Phaser 3 + TypeScript + Vite, portrait, fully offline.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies (first time only) |
| `npm run dev` | Dev server at http://localhost:5173 (debug tools on) |
| `npm test` | Unit tests (shuffle engine, scoring, levels, save data) |
| `npm run build` | Typecheck + production build into `dist/` (debug tools stripped) |
| `npm run preview` | Serve the production build locally |
| `npm run assets` | Re-process art from `art-src/` into `public/assets/` |

## Dev / debug (dev server only)

- `?level=N`: start directly at level N, e.g. http://localhost:5173/?level=14
- `D`: show a marker over the cup that holds the ball
- `S`: show seed, level config and the reserved magician zone
- `N`: skip to the next level

## Art pipeline

Original art lives in `art-src/` (not shipped). `npm run assets` trims transparent padding
(alpha < 12 counts as empty), resizes to ~2x on-screen size, puts paired assets (hearts,
stars, level buttons, sound on/off, progress bar, all round buttons) on shared canvases,
and writes `src/assets/assetMeta.json`. Add new art to `art-src/<folder>/` and re-run.

## Layout

- `src/engine/`: pure TypeScript shuffle engine, RNG, round rules (no Phaser; unit tested)
- `src/levels/levels.ts`: the 20 levels as data
- `src/game/`: stage geometry, cup view, shuffle playback, effects
- `src/scenes/`: Boot, Preload, Title, Game, Pause
- `src/ui/`: HUD, popups, buttons, progress bar, text/image helpers
- `src/services/`: storage wrapper (async, Capacitor-ready), progress, ad placeholder
- `src/debug/`: dev-only tools
