export const isReadyStatus = (status: number): boolean => {
  return status >= 200 && status <= 403;
};
