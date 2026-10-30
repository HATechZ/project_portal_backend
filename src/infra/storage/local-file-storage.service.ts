import { createReadStream } from 'node:fs';
import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { dirname, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  FileStorage,
  StoredFileInput,
} from '../../contracts/storage/file-storage.port';
import type { AppConfiguration } from '../../config/configuration';

@Injectable()
export class LocalFileStorageService implements FileStorage {
  private readonly root: string;

  constructor(config: ConfigService<AppConfiguration, true>) {
    this.root = config.get('storage.root', { infer: true });
  }

  async put(input: StoredFileInput): Promise<void> {
    const destination = this.pathFor(input.storageKey);
    await mkdir(dirname(destination), { recursive: true });
    const temporary = `${destination}.partial`;
    let renamed = false;
    try {
      await writeFile(temporary, input.content, { flag: 'wx' });
      await rename(temporary, destination);
      renamed = true;
      await access(destination);
    } catch (error) {
      await rm(temporary, { force: true });
      if (renamed) await rm(destination, { force: true });
      throw error;
    }
  }

  async remove(storageKey: string): Promise<void> {
    await rm(this.pathFor(storageKey), { force: true });
  }

  async openReadStream(storageKey: string): Promise<Readable> {
    const path = this.pathFor(storageKey);
    await access(path);
    return createReadStream(path);
  }

  private pathFor(storageKey: string): string {
    const path = resolve(this.root, storageKey);
    if (!path.startsWith(`${this.root}${sep}`)) {
      throw new Error('Storage key escapes the configured uploads root');
    }
    return path;
  }
}
