import { Request } from 'express';

export class LogoutCommand {
  constructor(readonly request: Request) {}
}
