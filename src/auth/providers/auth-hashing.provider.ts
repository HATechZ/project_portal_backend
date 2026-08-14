import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';

@Injectable()
export class AuthHashingProvider {
  private readonly saltRounds = 12;

  hash(password: string): Promise<string> {
    return hash(password, this.saltRounds);
  }

  compare(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }
}
