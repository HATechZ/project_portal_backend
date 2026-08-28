import { SessionActor, SessionUser } from './session.types';

export const SESSION_AUTHENTICATOR = Symbol('SESSION_AUTHENTICATOR');

export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  sid: string;
  type: 'access';
}

/**
 * What the guards need from `auth`, and nothing more.
 *
 * The guards live here so no feature module imports `AuthModule` to protect a
 * route; they reach `auth` through this token instead. Issuing, rotating, and
 * revoking tokens stay behind the boundary — they are the auth module's job,
 * not a guard's.
 */
export interface SessionAuthenticator {
  verifyAccessToken(token: string): Promise<AccessTokenPayload>;
  isSessionActive(id: string, userId: string): Promise<boolean>;
  findActiveUser(id: string): Promise<SessionUser | null>;
  findActiveActor(userId: string): Promise<SessionActor | null>;
}
