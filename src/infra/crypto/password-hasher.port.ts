export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

/**
 * Password hashing is infrastructure, not an `auth` capability.
 *
 * `user` needs it to set a password and `auth` needs it to check one; when it
 * lived in `auth/providers` the only way for `user` to hash was to import
 * another feature module (Art. XI). Both now depend on this token, and neither
 * on the other.
 */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, passwordHash: string): Promise<boolean>;
}
