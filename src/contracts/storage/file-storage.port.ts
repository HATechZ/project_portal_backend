export interface StoredFileInput {
  storageKey: string;
  content: Buffer;
}

export interface FileStorage {
  put(input: StoredFileInput): Promise<void>;
  remove(storageKey: string): Promise<void>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');
