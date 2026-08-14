export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
