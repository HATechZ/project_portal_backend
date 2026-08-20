import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { AuthService } from '../auth.service';
import { AuthUser } from '../auth-user.type';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private readonly authService: AuthService) {
    super();
  }

  serializeUser(
    user: AuthUser,
    done: (error: Error | null, id?: string) => void,
  ) {
    done(null, user.id);
  }

  async deserializeUser(
    id: string,
    done: (error: Error | null, user?: AuthUser | false) => void,
  ) {
    try {
      done(null, (await this.authService.findSessionUser(id)) ?? false);
    } catch (error) {
      done(error as Error);
    }
  }
}
