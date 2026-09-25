# Chimp Jump asset pipeline

This branch establishes a production asset contract without changing gameplay, physics, animation, server behavior, input, or rendering architecture.

## Audited baseline

Source main commit: f2e7b2830651dd2ed53ea47452dae4b908953ec1.

The tracked public tree contained 40 files totaling 90,453,453 bytes (86.26 MiB). The normal build also materializes public/model/steamboat_willie.glb from its checked-in Brotli source, so post-build reports contain one additional generated file.

The first safe cleanup removes 5,308,557 tracked bytes:
- 2,536,280 bytes: exact duplicate public/screens/card-arena-start.png
- 2,713,903 bytes: exact duplicate public/screens/chimp-dash-start.png
- 21,994 bytes: unused Ski AVIF/WebP alternates; the active launcher uses cartridge-ski-hq.webp
- 36,380 bytes: unreferenced public/ui/steamboat-willie.png

The resulting tracked public tree is 85,144,896 bytes (81.20 MiB), a 5.87% reduction with no visual re-encoding. The duplicate screen references were converged onto their byte-identical hashed copies.

## Loading tiers

TIER 0 - CRITICAL SHELL: launcher art needed to render the game selector.
TIER 1 - GAME START: environment manifest/assets and current game start presentation.
TIER 2 - LAZY: alternate built-in Chimpions and non-critical audio.
TIER 3 - DEFERRED OR UNUSED: assets with no detected runtime/build reference; manual proof is still required before deletion.

The asset report selects the smallest approved Chimpion as the recommended deterministic first-presentation candidate. Runtime selection is intentionally not changed on this branch.

## CI contract

Run npm run check:assets.

The check writes checks/assets-report.json and validates:
- exactly the approved 10-character roster
- GLB 2.0 structure, skins, joints, and skinned meshes
- branch-moss GLB integrity
- zero exact duplicate public assets
- no built-in asset requiring Draco, Meshopt, or KTX2 while decoder support is absent
- hard total, character, launcher-image, and image-dimension regression budgets

The report includes file inventory, byte sizes, SHA-256 hashes, loading tiers, reference status, PNG/WebP dimensions where readable, estimated external RGBA+mipmap texture memory, GLB geometry/material/texture/skin/animation counts, largest assets, possible unreferenced assets, target gaps, and an Archon-specific record.

## Budgets and targets

Hard gates are regression limits. The initial total hard budget is 84 MiB post-build, below the audited pre-cleanup payload. Character and launcher caps prevent further growth while heavyweight assets are optimized.

Quality-preserving targets are more aggressive and currently report gaps without failing CI:
- total public payload: 50 MiB
- approved character GLB: 6 MiB target each
- launcher image: 600 KiB target each

Tighten the hard gates after verified binary savings land.

## Compression compatibility

This branch does not introduce KHR_draco_mesh_compression, EXT_meshopt_compression, or KHR_texture_basisu. The current local-upload validator rejects those required extensions, and no atomic runtime decoder setup exists for built-in assets on this branch.

If a later integration branch adds DRACOLoader, MeshoptDecoder, or KTX2Loader, decoder initialization and converted assets must land together. Legacy uncompressed user-supplied GLBs must continue to work.

## Cache and preload policy

Use long-lived immutable caching for content-addressed/hashed assets. Use short-lived or revalidated caching for manifests, HTML, and version metadata. Preload only resources required for the current shell or game start; alternate characters, music, and later screens should remain lazy/deferred.

## Binary optimization policy

Do not mass-reencode. Optimize one category at a time and verify before/after renders. Preserve character skeletons, bone names, skinning, UVs, normals, rig auto-detection, material identity, texture seams, and correct color-space interpretation.

The Archon remains the highest-priority GLB optimization candidate. The generated report records its current byte size, triangles, materials, textures, extensions, skins, nodes, and embedded image metadata so the next binary pass can target the actual weight source instead of blindly degrading art.
