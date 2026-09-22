import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import type {
  FileStorage,
  StoredFileInput,
} from '../../contracts/storage/file-storage.port';

@Injectable()
export class LocalFileStorageService implements FileStorage {
  private readonly root = resolve(process.cwd(), 'uploads');

  async put(input: StoredFileInput): Promise<void> {
    const destination = this.pathFor(input.storageKey);
    await mkdir(dirname(destination), { recursive: true });
    const temporary = `${destination}.partial`;
    await writeFile(temporary, input.content, { flag: 'wx' });
    await rename(temporary, destination);
  }

  async remove(storageKey: string): Promise<void> {
    await rm(this.pathFor(storageKey), { force: true });
  }

  private pathFor(storageKey: string): string {
    const path = resolve(this.root, storageKey);
    if (!path.startsWith(`${this.root}${sep}`)) {
      throw new Error('Storage key escapes the configured uploads root');
    }
    return path;
  }
}
