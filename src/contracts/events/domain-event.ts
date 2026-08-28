import { randomUUID } from 'node:crypto';

/**
 * The wire shape of every domain event — one outbox row, one broker message.
 *
 * Shared kernel: publishers and consumers both import this, so it names no
 * framework, ORM, or transport type (Art. XI §3). Timestamps are ISO 8601
 * strings so the wire format needs no serializer on either side.
 */
export interface DomainEventEnvelope<
  TPayload extends object = Record<string, unknown>,
> {
  /** Identity. Also the outbox row id, and the key consumers dedupe on. */
  readonly eventId: string;
  /** The contract class name, e.g. `WorkRequestStatusChanged`. */
  readonly eventType: string;
  /** `<module>.<aggregate>.<event>` — the topic exchange binding key. */
  readonly routingKey: string;
  /** Every event belongs to exactly one tenant. Consumers restore from it. */
  readonly tenantId: string;
  /** ISO 8601, in UTC. */
  readonly occurredAt: string;
  /** The acting profile. Absent for system-originated events. */
  readonly actorId?: string;
  /** Causality — the originating request id, carried across every hop. */
  readonly correlationId?: string;
  /** Ids and primitives only. Never an entity, never a Prisma model. */
  readonly payload: TPayload;
}

/**
 * A concrete contract event class. Named as a type so the relay can hold a list
 * of them without knowing any one of them.
 */
export type DomainEventType<TEvent extends DomainEvent = DomainEvent> = new (
  ...args: any[]
) => TEvent;

/**
 * What a producer supplies. Identity and time are filled in for it, but both
 * stay overridable so a relay can rebuild an event exactly as it was raised.
 */
export interface DomainEventOrigin {
  readonly tenantId: string;
  readonly actorId?: string;
  readonly correlationId?: string;
  readonly eventId?: string;
  readonly occurredAt?: string;
}

/**
 * The base every contract event extends.
 *
 * It is a class rather than a bare interface for one load-bearing reason: the
 * in-process transport routes on the published instance's constructor, so an
 * object literal would reach no handler at all.
 */
export abstract class DomainEvent<
  TPayload extends object = Record<string, unknown>,
> implements DomainEventEnvelope<TPayload> {
  abstract readonly eventType: string;
  abstract readonly routingKey: string;
  abstract readonly payload: TPayload;

  readonly eventId: string;
  readonly tenantId: string;
  readonly occurredAt: string;
  readonly actorId?: string;
  readonly correlationId?: string;

  protected constructor(origin: DomainEventOrigin) {
    this.eventId = origin.eventId ?? randomUUID();
    this.tenantId = origin.tenantId;
    this.occurredAt = origin.occurredAt ?? new Date().toISOString();
    this.actorId = origin.actorId;
    this.correlationId = origin.correlationId;
  }
}
