import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextData {
  requestId: string;
  actorId?: string;
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
};
