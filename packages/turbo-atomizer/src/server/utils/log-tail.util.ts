export const lastLines = (text: string, count: number): string => {
  const lines = text.split('\n');
  const isTerminated = text.endsWith('\n');
  const withTrailingEmpty = count + 1;
  const kept = isTerminated ? withTrailingEmpty : count;

  return lines.slice(-kept).join('\n');
};
