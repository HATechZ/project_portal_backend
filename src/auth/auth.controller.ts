import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { UserEntity } from '../users/entities/user.entity';
import { AuthUser } from './auth-user.type';
import { LoginCommand } from './commands/login.command';
import { LogoutCommand } from './commands/logout.command';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { GetCurrentUserQuery } from './queries/get-current-user.query';

type AuthenticatedRequest = Request & { user: AuthUser };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Log in and create a session' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: UserEntity })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  login(@Body() _dto: LoginDto, @Req() request: AuthenticatedRequest) {
    return this.commandBus.execute(new LoginCommand(request, request.user));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Log out and destroy the session' })
  @ApiNoContentResponse({ description: 'Logged out' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  logout(@Req() request: AuthenticatedRequest) {
    return this.commandBus.execute(new LogoutCommand(request));
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Get the authenticated user' })
  @ApiOkResponse({ type: UserEntity })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  me(@Req() request: AuthenticatedRequest) {
    return this.queryBus.execute(new GetCurrentUserQuery(request.user));
  }
}
