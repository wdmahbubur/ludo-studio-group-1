# Ludo Studio — Group 1, Project 7

CSE444.5 Group 1 project: an interactive 3D Ludo game built with Three.js.

## Group members

- Abu Sayed
- Md Mahbubur Rahman
- Khaleda Akhter Sumi

## Assignment features implemented

- Three.js 3D scene with perspective projection
- Custom GLSL vertex and fragment shaders for the board
- Textured board, dice, pawns, frame and surfaces
- Ambient, hemisphere and directional lighting with shadows
- Keyboard camera movement and zoom
- Mouse drag/orbit interaction
- Click the board to switch between Porcelain, Midnight and Walnut textures
- Animated rotating/tumbling dice
- Animated pawn movement
- Two-player and four-player local Ludo gameplay
- Legal move highlighting, captures, safe squares, home lanes and winner detection
- Presentation/demo mode for repeatable capture and finish examples

## Run locally

```bash
npm start
```

Then open `http://localhost:5173`.

The browser loads pinned Three.js r140.2 from jsDelivr, so internet access is needed when loading the game from this GitHub/Vercel version.

## Test

```bash
npm run check
npm test
npm run build
```

## Vercel

The repository includes `vercel.json`. Vercel runs:

```bash
npm run build
```

and publishes the generated `dist/` directory.

## Main controls

| Control | Action |
|---|---|
| W/A/S/D or arrow keys | Move/orbit camera |
| Q/E or mouse wheel | Zoom |
| Mouse drag | Orbit camera |
| Click empty board area / T | Change board texture |
| Space or click die | Roll dice |
| Click highlighted pawn / 1–4 | Move a legal token |
| R | Reset camera |
| V | Near-top perspective view |
| L | Toggle moving light |

## Notes

This is a local same-device multiplayer game; hosting it does not add online multiplayer. The assignment defines the graphics requirements but not every Ludo rule, so the implemented rule variant is documented in the source/report files.

**Academic integrity:** this project was developed with AI assistance. Review and understand the code, and disclose assistance if required by your instructor.
