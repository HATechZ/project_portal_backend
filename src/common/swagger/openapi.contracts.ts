export interface OpenApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta: { requestId?: string; timestamp: string };
}

export interface OpenApiErrorEnvelope {
  success: false;
  error: { code: string; message: string | string[]; details?: unknown };
  meta: { requestId?: string; timestamp: string };
}
