export const PASSWORD_SETUP_INITIATOR = Symbol('PASSWORD_SETUP_INITIATOR');

export interface PasswordSetupInitiator {
  initiate(email: string): Promise<void>;
}
