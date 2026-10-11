import { describe, expect, it } from 'vitest';

import { validateListLine, validateSpecLocation, validateTaskPath } from './spec-validation.util.ts';
import { DEFAULT_SPEC_GLOBS } from '../../shared/atomizer/common/atomizer.const.ts';

describe('FEATURE: spec validation', () => {
  describe('GIVEN a list line Playwright would misparse', () => {
    const misparsedLines = [
      '[x]/a.spec.ts',
      '#a.spec.ts',
      'a>b.spec.ts',
      'a›b.spec.ts',
      'a.spec.ts:12',
      'a.spec.ts:12:3',
      'a.spec.ts:12:',
      ' a.spec.ts',
      'a.spec.ts ',
      'a\nb.spec.ts'
    ];

    it.each(misparsedLines)('WHEN %j is validated THEN the error names the line and asks for a rename', (line) => {
      const error = validateListLine(line);

      expect(error).toContain(line);
      expect(error).toContain('rename');
    });
  });

  describe('GIVEN a list line Playwright parses as a file path', () => {
    const parsedLines = ['app/x.spec.ts', 'my spec.spec.ts', 'a.spec.ts:x', 'a[1].spec.ts', 'a#b.spec.ts'];

    it.each(parsedLines)('WHEN %j is validated THEN no error is returned', (line) => {
      const error = validateListLine(line);

      expect(error).toBeUndefined();
    });
  });

  describe('GIVEN a task path with a glob metacharacter', () => {
    const globPaths = [
      'tests/a[1].spec.ts',
      'tests/a]1.spec.ts',
      'tests/{a}.spec.ts',
      'tests/a*.spec.ts',
      'tests/a?.spec.ts',
      'tests/!a.spec.ts',
      'tests/a(1.spec.ts',
      'tests/a)1.spec.ts',
      'tests/a,b.spec.ts',
      'tests/a<b.spec.ts',
      'tests/a>b.spec.ts'
    ];

    it.each(globPaths)('WHEN %j is validated THEN the error names the path and asks for a rename', (taskPath) => {
      const error = validateTaskPath(taskPath);

      expect(error).toContain(taskPath);
      expect(error).toContain('rename');
    });
  });

  describe('GIVEN a task path with "#"', () => {
    it('WHEN it is validated THEN the error says turbo reads "#" as package#task and asks for a rename', () => {
      const error = validateTaskPath('tests/a#b.spec.ts');

      expect(error).toContain('tests/a#b.spec.ts');
      expect(error).toContain('package#task');
      expect(error).toContain('rename');
    });
  });

  describe('GIVEN a task path turbo accepts', () => {
    const acceptedPaths = ['tests/my spec.spec.ts', 'tests/a$b.spec.ts', 'tests/a@b.spec.ts', 'tests/a+b.spec.ts'];

    it.each(acceptedPaths)('WHEN %j is validated THEN no error is returned', (taskPath) => {
      const error = validateTaskPath(taskPath);

      expect(error).toBeUndefined();
    });
  });

  describe('GIVEN the default specGlobs', () => {
    it('WHEN a spec outside the package root is validated THEN the error names it and says why', () => {
      const error = validateSpecLocation('../shared/x.spec.ts', DEFAULT_SPEC_GLOBS);

      expect(error).toContain('"../shared/x.spec.ts" is outside the test package');
    });

    it('WHEN a spec on another drive is validated THEN the error says it is outside the test package', () => {
      const error = validateSpecLocation('/d/shared/x.spec.ts', DEFAULT_SPEC_GLOBS);

      expect(error).toContain('outside the test package');
    });

    it('WHEN a file no specGlobs entry matches is validated THEN the error names it and the fix', () => {
      const error = validateSpecLocation('tests/a.e2e.ts', DEFAULT_SPEC_GLOBS);

      expect(error).toContain('"tests/a.e2e.ts" matches no specGlobs entry');
    });

    it('WHEN a matching spec inside the package is validated THEN no error is returned', () => {
      const error = validateSpecLocation('tests/nested/c.spec.ts', DEFAULT_SPEC_GLOBS);

      expect(error).toBeUndefined();
    });
  });
});
