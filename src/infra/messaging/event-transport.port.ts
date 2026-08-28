import { DomainEventEnvelope } from '../../contracts/events/domain-event';

export const EVENT_TRANSPORT = Symbol('EVENT_TRANSPORT');

/**
 * The seam between the outbox relay and wherever events actually go.
 *
 * Deliberately one method (Art. X §4): the relay hands over an envelope and
 * learns only whether it left. Anything wider — acking, subscribing, topology —
 * would leak the broker back into the caller and make the in-process adapter a
 * pile of stubs. Only the relay depends on this token; producers never see it.
 */
export interface EventTransport {
  publish(event: DomainEventEnvelope): Promise<void>;
}
