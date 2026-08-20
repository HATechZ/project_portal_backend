import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuthService } from '../auth.service';
import { AuthUser } from '../auth-user.type';
import { LoginCommand } from '../commands/login.command';

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand, AuthUser> {
  constructor(private readonly authService: AuthService) {}

  async execute({ request, user }: LoginCommand): Promise<AuthUser> {
    await new Promise<void>((resolve, reject) =>
      request.session.regenerate((error) =>
        error ? reject(this.asError(error)) : resolve(),
      ),
    );
    await new Promise<void>((resolve, reject) =>
      request.logIn(user, (error) =>
        error ? reject(this.asError(error)) : resolve(),
      ),
    );
    return this.authService.recordLogin(user.id);
  }

  private asError(value: unknown): Error {
    return value instanceof Error ? value : new Error(String(value));
  }
}
