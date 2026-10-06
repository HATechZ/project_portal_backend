import { SetMetadata } from '@nestjs/common';
import type { SessionActor } from './session.types';

/** Feature-owned checks run only after the generic explicit-grant check. */
export type FinalAuthorizationCheck = {
  kind: 'resource' | 'state' | 'assignment';
  reason: string;
  validate: (
    request: unknown,
    actor: SessionActor,
  ) => boolean | Promise<boolean>;
};

export const FINAL_AUTHORIZATION_CHECKS_KEY = 'final_authorization_checks';

/**
 * Attaches feature business checks without teaching the central guard about a
 * resource, state machine, or assignment model.
 */
export const FinalAuthorizationChecks = (
  ...checks: FinalAuthorizationCheck[]
) => SetMetadata(FINAL_AUTHORIZATION_CHECKS_KEY, checks);
