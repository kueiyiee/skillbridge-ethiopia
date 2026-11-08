export type AuthState = {
  token: string | null;
  userId: string | null;
};

export const authStore = {
  state: { token: null, userId: null } as AuthState,
  setAuth(next: Partial<AuthState>) {
    this.state = { ...this.state, ...next };
  },
  clear() {
    this.state = { token: null, userId: null };
  },
};
