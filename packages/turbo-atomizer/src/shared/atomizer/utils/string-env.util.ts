type EnvEntry = [string, string | undefined];

type StringEnvEntry = [string, string];

const isStringEntry = (entry: EnvEntry): entry is StringEnvEntry => entry[1] !== undefined;

export const toStringEnv = (env: NodeJS.ProcessEnv): Record<string, string> => {
  const entries = Object.entries(env).filter(isStringEntry);

  return Object.fromEntries(entries);
};
