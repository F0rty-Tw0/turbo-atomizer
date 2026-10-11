import type { TurboJsonDoc } from '../../shared/turbo/common/turbo-json.type.ts';
import type { OutsideImport } from '../common/doctor-facts.type.ts';

/** The files `spec` imports that lie outside `packageDir`; both are posix, `files` and `packageDir` relative to the workspace root. */
export const toOutsideImports = (spec: string, files: string[], packageDir: string): OutsideImport[] => {
  const isOutside = (file: string): boolean => !file.startsWith(`${packageDir}/`);
  const outsideFiles = files.filter(isOutside);

  const toOutsideImport = (file: string): OutsideImport => {
    const outsideImport: OutsideImport = { spec, file };

    return outsideImport;
  };

  return outsideFiles.map(toOutsideImport);
};

export const hasFutureFlag = (turboJson: TurboJsonDoc | undefined, flag: string): boolean => {
  return turboJson?.content.futureFlags?.[flag] === true;
};
