import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextData {
  requestId: string;
  actorId?: string;
  tenantId?: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContextData>();

export const RequestContext = {
  run<T>(context: RequestContextData, callback: () => T): T {
    return requestContextStorage.run(context, callback);
  },
  get(): RequestContextData | undefined {
    return requestContextStorage.getStore();
  },
  requestId(): string | undefined {
    return requestContextStorage.getStore()?.requestId;
  },
  actorId(): string | undefined {
    return requestContextStorage.getStore()?.actorId;
  },
  setActorId(actorId: string): void {
    const context = requestContextStorage.getStore();
    if (!context) throw new Error('Request context is required');
    context.actorId = actorId;
  },
  tenantId(): string | undefined {
    return requestContextStorage.getStore()?.tenantId;
  },
  requireTenantId(): string {
    const tenantId = requestContextStorage.getStore()?.tenantId;
    if (!tenantId) throw new Error('Tenant context is required');
    return tenantId;
  },
};
