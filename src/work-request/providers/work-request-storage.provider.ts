import { Injectable } from '@nestjs/common';
import type { FileStorage } from '../../contracts/storage/file-storage.port';
import { WorkRequestStorageCleanupRepository } from '../repositories/work-request-storage-cleanup.repository';

@Injectable()
export class WorkRequestStorageProvider {
  constructor(private readonly cleanup?: WorkRequestStorageCleanupRepository) {}
  async putAll(
    storage: FileStorage,
    files: { storageKey: string; content: Buffer }[],
  ): Promise<string[]> {
    const stored: string[] = [];
    for (const file of files) {
      await storage.put({ storageKey: file.storageKey, content: file.content });
      stored.push(file.storageKey);
    }
    return stored;
  }
  async compensate(storage: FileStorage, keys: string[]): Promise<void> {
    for (const storageKey of keys) {
      try {
        await storage.remove(storageKey);
      } catch (error) {
        if (this.cleanup) {
          await this.cleanup.enqueue(
            storageKey,
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }
    }
  }
}
