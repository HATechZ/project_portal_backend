export interface RedisCacheCodec<T> {
  encode(value: T): string;
  decode(value: string): T;
}

export class JsonRedisCacheCodec<T> implements RedisCacheCodec<T> {
  encode(value: T): string {
    return JSON.stringify(value);
  }
  decode(value: string): T {
    return JSON.parse(value) as T;
  }
}
