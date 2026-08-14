/**
 * Local `pack:local` stamp. Empty string for normal `build:lib` / npm publish — no badge.
 * Values are compile-time defines from Vite (see `scripts/pack-local.mjs`).
 */
export const LOCAL_PACK_BUILD_AT: string =
  typeof __RIP_LOCAL_BUILD_AT__ !== 'undefined' ? __RIP_LOCAL_BUILD_AT__ : '';

export const PACKAGE_VERSION: string =
  typeof __RIP_PACKAGE_VERSION__ !== 'undefined' && __RIP_PACKAGE_VERSION__
    ? __RIP_PACKAGE_VERSION__
    : '0.0.0';

export const isLocalPackBuild = LOCAL_PACK_BUILD_AT.length > 0;
