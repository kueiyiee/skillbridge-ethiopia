export type Role = 'candidate' | 'employer' | 'admin';

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
};
