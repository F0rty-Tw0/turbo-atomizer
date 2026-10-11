/** Replaced by esbuild `define` with the package version at build time; undefined in unit tests. */
// eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention -- name fixed by the esbuild define in tools/src/build-package-bundle.ts
declare const __TURBO_ATOMIZER_VERSION__: string;

export const getCliVersion = (): string => __TURBO_ATOMIZER_VERSION__;
