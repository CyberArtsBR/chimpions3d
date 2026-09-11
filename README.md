# Chimpion rig sandbox

Small Vite + vanilla JavaScript + Three.js locomotion test. Uses the existing `public/model/chimpion.glb`; no imported animations or physics engine.

## Run

Use Node.js 22.12 or newer.

```sh
npm install
npm run dev
npm run build
npm run preview
```

W / Up moves forward, S / Down backward, A / D rotates, Shift runs, Space jumps.
Idle / Walk / Run buttons inspect poses in place; Jump performs one jump and returns to the previous forced state. Movement keys resume normal control. Show Skeleton overlays the existing skeleton.

The console prints every bone and its hierarchy, plus a mapping table. Edit the clearly labeled BONE_MAPPING at the top of src/main.js to override exact bone names. MODEL_YAW can correct forward orientation. Unresolved optional bones are reported; an unsafe arm mapping keeps the model hidden.

The GLB stays hidden until arms are lowered, idle is applied, matrices are updated, and arm directions pass validation. All animation is relative to cached quaternions. The original file, rest-pose data and inverse bind matrices are never changed. No rest-pose toggle is exposed.

Procedural states: IDLE, WALK, RUN, JUMP, LAND. Jump phases: crouch, takeoff, airborne, landing. LAND is shown briefly in the state display so landing can be inspected. Camera follows behind and above. Feet use a basic swing, not IK; small sliding and floor penetration during extreme poses are possible. This is a skinning inspection sandbox, not production animation.

GitHub Actions runs the production build and browser smoke checks against the actual GLB.
