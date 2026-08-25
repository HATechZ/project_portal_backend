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
  ApiNoContentResponse,
  ApiAcceptedResponse,
  ApiOperation,
  ApiTags,
  ApiSecurity,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ActiveUser } from './decorators/active-user.decorator';
import {
  AuthUserResponseDto,
  ForgotPasswordDto,
  LoginDto,
  LoginResponseDto,
  RefreshResponseDto,
  RefreshTokenDto,
  ResetPasswordDto,
} from './dtos';
import { AuthenticatedGuard } from './guards/authenticated.guard';
import type { AuthenticatedRequest } from './guards/authenticated.guard';
import type { SessionUser } from './repositories';
import { AuthService } from './auth.service';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import {
  ApiStandardBadRequestResponse,
  ApiStandardForbiddenResponse,
  ApiStandardOkResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';

@ApiTags('auth')
@Controller('auth')
@UseGuards(TenantContextGuard)
@ApiStandardBadRequestResponse()
@ApiStandardForbiddenResponse()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiSecurity('tenant')
  @ApiOperation({ summary: 'Log in and issue JWT credentials' })
  @ApiStandardOkResponse(LoginResponseDto, 'Login successful')
  @ResponseMessage('Login successful')
  @ApiStandardUnauthorizedResponse('Invalid email or password')
  login(@Req() request: Request, @Body() input: LoginDto) {
    return this.authService.login(request, input);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiSecurity('tenant')
  @ApiOperation({ summary: 'Rotate a refresh token and issue new credentials' })
  @ApiStandardOkResponse(RefreshResponseDto, 'Token refreshed successfully')
  @ResponseMessage('Token refreshed successfully')
  @ApiStandardUnauthorizedResponse('Invalid or expired refresh token')
  refresh(@Req() request: Request, @Body() input: RefreshTokenDto) {
    return this.authService.refresh(request, input.refreshToken);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiSecurity('tenant')
  @ApiOperation({ summary: 'Forgot password - request reset instructions' })
  @ApiAcceptedResponse({
    description: 'Request accepted whether or not the account exists',
  })
  @ResponseMessage(
    'If an eligible account exists, password reset instructions have been sent',
  )
  forgotPassword(@Body() input: ForgotPasswordDto): Promise<void> {
    return this.authService.forgotPassword(input.email);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiSecurity('tenant')
  @ApiOperation({ summary: 'Reset a password using a single-use token' })
  @ApiNoContentResponse({ description: 'Password reset successfully' })
  @ResponseMessage('Password reset successfully')
  resetPassword(@Body() input: ResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(input.token, input.newPassword);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard)
  @ApiSecurity({ bearer: [], tenant: [] })
  @ApiOperation({ summary: 'Log out and revoke the current token session' })
  @ApiNoContentResponse({ description: 'Logged out' })
  @ResponseMessage('Logout successful')
  @ApiStandardUnauthorizedResponse()
  logout(@Req() request: AuthenticatedRequest) {
    return this.authService.logout(request.authSessionId!);
  }

  @Get('me')
  @UseGuards(AuthenticatedGuard)
  @ApiSecurity({ bearer: [], tenant: [] })
  @ApiOperation({ summary: 'Get the authenticated user' })
  @ApiStandardOkResponse(AuthUserResponseDto, 'Authenticated user returned')
  @ResponseMessage('Authenticated user returned')
  @ApiStandardUnauthorizedResponse()
  me(@ActiveUser() user: SessionUser) {
    return this.authService.currentUser(user);
  }
}
