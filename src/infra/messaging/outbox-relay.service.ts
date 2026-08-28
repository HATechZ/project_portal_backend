import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfiguration } from '../../config/configuration';
import { DomainEventEnvelope } from '../../contracts/events/domain-event';
import { PrismaService } from '../prisma/prisma.service';
import { EventRegistry } from './event-registry';
import { EVENT_TRANSPORT, type EventTransport } from './event-transport.port';

/**
 * The only publisher in the system, and the only writer of `publishedAt`.
 *
 * It reads through `prisma.unscoped` on purpose: a relay tick has no request
 * and therefore no tenant, and its whole job is to drain every tenant's
 * backlog. This is the one place in the codebase where crossing tenants is
 * correct — which is why it is confined to a single query in a single file.
 *
 * Delivery is at-least-once by construction. A publish that succeeds and then
 * fails to stamp the row will publish again next tick; consumers dedupe through
 * `InboxRepository`. The reverse — stamping before publishing — would lose
 * events, which no consumer can repair.
 */
@Injectable()
export class OutboxRelayService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer?: NodeJS.Timeout;
  private ticking = false;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: EventRegistry,
    @Inject(EVENT_TRANSPORT) private readonly transport: EventTransport,
    private readonly config: ConfigService<AppConfiguration, true>,
  ) {}

  onApplicationBootstrap(): void {
    const messaging = this.config.get('messaging', { infer: true });
    if (!messaging.relayEnabled) {
      this.logger.log('Outbox relay disabled (MESSAGING_RELAY_ENABLED=false)');
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, messaging.relayIntervalMs);
    // Do not hold the event loop open on shutdown.
    this.timer.unref();
    this.logger.log(
      `Outbox relay started — every ${messaging.relayIntervalMs}ms, ${messaging.relayBatchSize} per batch`,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    // Let an in-flight batch finish rather than tearing the connection out
    // from under a half-stamped row.
    while (this.ticking) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    this.logger.log('Outbox relay stopped');
  }

  /** Exposed for the walkthrough and for tests; the timer is the normal path. */
  async tick(): Promise<number> {
    // A slow batch must not overlap the next tick — two publishers of the same
    // row would double-deliver for no benefit.
    if (this.ticking || this.stopped) return 0;
    this.ticking = true;
    try {
      return await this.drain();
    } catch (error) {
      this.logger.error(
        'Outbox relay tick failed',
        error instanceof Error ? error.stack : String(error),
      );
      return 0;
    } finally {
      this.ticking = false;
    }
  }

  private async drain(): Promise<number> {
    const { relayBatchSize } = this.config.get('messaging', { infer: true });
    const pending = await this.prisma.unscoped.outboxMessage.findMany({
      where: { publishedAt: null },
      orderBy: { occurredAt: 'asc' },
      take: relayBatchSize,
    });

    let published = 0;
    for (const row of pending) {
      if (this.stopped) break;
      const envelope: DomainEventEnvelope = {
        eventId: row.id,
        eventType: row.eventType,
        routingKey: row.routingKey,
        tenantId: row.tenantId,
        occurredAt: row.occurredAt.toISOString(),
        actorId: row.actorId ?? undefined,
        correlationId: row.correlationId ?? undefined,
        payload: (row.payload ?? {}) as Record<string, unknown>,
      };

      try {
        // Restore the class so in-process handlers match on constructor.
        // Unknown types are logged by the registry and published as the bare
        // envelope — a remote transport does not care, and stalling the whole
        // backlog on one unregistered type would be worse.
        const event = this.registry.rebuild(envelope) ?? envelope;
        await this.transport.publish(event);
        await this.prisma.unscoped.outboxMessage.update({
          where: { id: row.id },
          data: { publishedAt: new Date() },
        });
        published += 1;
      } catch (error) {
        await this.recordFailure(row.id, row.attempts, error);
      }
    }
    return published;
  }

  private async recordFailure(
    id: string,
    attempts: number,
    error: unknown,
  ): Promise<void> {
    // The row stays unpublished, so the next tick retries it. Nothing is
    // dropped; the error is kept alongside so a stuck event can be triaged
    // without reading logs.
    await this.prisma.unscoped.outboxMessage.update({
      where: { id },
      data: {
        attempts: attempts + 1,
        lastError: error instanceof Error ? error.message : String(error),
      },
    });
    this.logger.warn(
      `Outbox message ${id} failed to publish (attempt ${attempts + 1})`,
    );
  }
}
