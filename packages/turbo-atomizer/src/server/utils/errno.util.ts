export const errorCode = (error: unknown): string | undefined => {
  const isError = error instanceof Error;

  if (!isError) return undefined;

  if (!('code' in error)) return undefined;

  const code: unknown = error.code;

  if (typeof code !== 'string') return undefined;

  return code;
};
