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
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ActiveUser } from './decorators/active-user.decorator';
import { LoginDto, RegisterDto } from './dtos';
import { AuthenticatedGuard } from './guards/authenticated.guard';
import type { SessionUser } from './repositories';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in and create a session' })
  @ApiOkResponse({ description: 'Authenticated user' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  login(@Req() request: Request, @Body() input: LoginDto) {
    return this.authService.login(request, input);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register and create a session' })
  @ApiCreatedResponse({ description: 'Registered user' })
  @ApiConflictResponse({ description: 'Email is already in use' })
  register(@Req() request: Request, @Body() input: RegisterDto) {
    return this.authService.register(request, input);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard)
  @ApiOperation({ summary: 'Log out and destroy the session' })
  @ApiNoContentResponse({ description: 'Logged out' })
  logout(@Req() request: Request) {
    return this.authService.logout(request);
  }

  @Get('me')
  @UseGuards(AuthenticatedGuard)
  @ApiOperation({ summary: 'Get the authenticated user' })
  @ApiOkResponse({ description: 'Authenticated user' })
  me(@ActiveUser() user: SessionUser) {
    return this.authService.currentUser(user);
  }
}
