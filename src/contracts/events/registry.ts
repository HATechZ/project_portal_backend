import { DomainEventType } from './domain-event';

/**
 * Every contract event in the system, by class.
 *
 * This list is the one place a publishing module has to touch outside its own
 * folder, and it is deliberately not automatic: an event that nobody added here
 * cannot be rebuilt from its outbox row, and the relay says so loudly rather
 * than delivering something no handler will match.
 *
 * It lives in contracts, not in messaging infrastructure, because contracts is
 * the shared kernel — infra may import it, and no module boundary is crossed by
 * naming an event here (Art. XI).
 */
export const DOMAIN_EVENT_TYPES: DomainEventType[] = [
  // Populated as publishing modules land their contracts.
];
