# Chimp Jump

A lightweight 2.5D endless jumper using Vite, vanilla JavaScript, Three.js and the existing rigged GLB.

## Play

A/D or Left/Right to steer. Jumping is automatic. Cross either edge to wrap. P/Escape pauses; Enter starts/retries. Touch the arrow buttons on mobile. Sound is optional.

Branches: green = solid, blue = moving, cracked wood = one bounce, red mushroom = spring. Collect bananas; highest altitude is your personal best. Themes change every 30 seconds of active play. Score stays on this device.

## Run

Node 22.12+:

```sh
npm install
npm run dev
npm run build
```

Render uses the root render.yaml and publishes dist after passing checks.

## Rig lab

Open /?rig=1 for the original inspection sandbox, its procedural animations, manual mapping, and skeleton toggle. Character gameplay code is in src/character.js. Original GLB/rest data is untouched; the character is prepared in idle before reveal, with 22-degree arm clearance.

## Avatars

public/avatars.json lists supplied characters. Only the current chimp is available initially. Add entries with id, name, url (relative to public), and optional bones mapping after checking each GLB in the rig lab. Only the selected avatar is loaded. A large catalog thumbnail grid is a follow-up once the remaining assets are supplied.

## Checks

node checks/physics.mjs checks the jump/landing rules and route spacing. GitHub Actions builds and tests the real GLB in both the lab and game, including pause, turns, themes, restart and mobile layout.

See docs/GAME_PLAN.md for the longer design. This first playable build covers the core loop; broad device profiling and the 221-avatar audit remain follow-up work.

## Canopy graphics update
The game now uses a closer camera, higher/slower jumps, widely spaced sideways transfers, textured branches, layered forest scenery, improved lighting and banana clusters. High detail enables shadows; Balanced reduces GPU cost and is the default for touch devices.

Choose **Load your GLB avatar** on the menu to use a local rigged character. It is not uploaded to a server or retained after reload. Supported files are self-contained, uncompressed humanoid GLB 2.0 exports up to 32 MB; unsupported rigs leave the previous avatar ready. **Flip avatar facing** accommodates a reversed source front direction.

See [the enhancement audit](docs/ENHANCEMENT_AUDIT.md) for before/after parameters, compatibility limits, checks and remaining art/performance work.
