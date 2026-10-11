/** What the merge-status reporter writes: the merged run's `FullResult.status`. */
export type MergeStatus = {
  readonly status: string;
};

/** What `collectBlobs` found for the current file tasks. */
export type BlobCollection = {
  readonly copied: number;
  /** Slugs whose `.atomizer/<slug>/` exists without a blob: exec reset the dir, then the task crashed before Playwright wrote it. */
  readonly missing: string[];
};
