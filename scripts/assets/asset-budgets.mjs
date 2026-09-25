const MiB=1024*1024;
const KiB=1024;

export const ASSET_BUDGETS=Object.freeze({
  // Hard regression gates. The total is below the audited pre-cleanup post-build payload.
  totalPublicBytes:84*MiB,
  maxCharacterBytes:15*MiB,
  maxLauncherImageBytes:3.25*MiB,
  maxImageDimension:8192
});

export const ASSET_TARGETS=Object.freeze({
  // Quality-preserving targets. Gaps are reported without failing CI until verified conversions land.
  totalPublicBytes:50*MiB,
  characterBytes:6*MiB,
  launcherImageBytes:600*KiB
});

export const UNSUPPORTED_BUILTIN_REQUIRED_EXTENSIONS=Object.freeze([
  'KHR_draco_mesh_compression',
  'EXT_meshopt_compression',
  'KHR_texture_basisu'
]);
