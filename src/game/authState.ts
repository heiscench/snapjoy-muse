// Tiny mutable holder for the current signed-in user id + username. Read by
// the presence channel + profile sync; not a React store.
export const authState = {
  userId: null as string | null,
  username: "" as string,
};
