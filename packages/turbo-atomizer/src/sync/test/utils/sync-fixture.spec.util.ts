import { join } from 'node:path';

export const syncFixtureFile = (name: string, file: string): string => join(import.meta.dirname, '../fixtures', name, file);
