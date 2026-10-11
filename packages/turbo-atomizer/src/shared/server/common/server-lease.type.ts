export type ServerLease = {
  readonly env: Record<string, string>;
  readonly release: () => void;
};
