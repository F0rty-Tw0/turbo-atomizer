/** Temporary merge config next to the Playwright config; init lists it in `.gitignore`. */
export const MERGE_CONFIG_FILE = 'playwright.atomizer-merge.config.mjs';

/** Blob report exec writes under `.atomizer/<slug>/`. */
export const BLOB_FILE = 'blob.zip';

/** Written by the merge-status reporter into the temp blob dir, removed with it; `playwright merge-reports` reads only `.zip` files there. */
export const MERGE_STATUS_FILE = 'merge-status.json';

/** The merged run status that exits 0; `failed`, `timedout` and `interrupted` exit 1. */
export const PASSED_STATUS = 'passed';
