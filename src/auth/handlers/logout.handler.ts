import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { LogoutCommand } from '../commands/logout.command';

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand, void> {
  async execute({ request }: LogoutCommand): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      request.logout((error) =>
        error ? reject(this.asError(error)) : resolve(),
      ),
    );
    await new Promise<void>((resolve, reject) =>
      request.session.destroy((error) =>
        error ? reject(this.asError(error)) : resolve(),
      ),
    );
  }

  private asError(value: unknown): Error {
    return value instanceof Error ? value : new Error(String(value));
  }
}
