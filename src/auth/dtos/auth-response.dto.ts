import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ActorRoleCode,
  WorkflowActionCode,
} from '../../generated/prisma/client';

export class AuthUserResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'System Administrator' }) fullName!: string;
  @ApiProperty({ example: 'admin@project-portal.local' }) email!: string;
  @ApiPropertyOptional({ nullable: true }) country!: string | null;
  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
  @ApiPropertyOptional({ nullable: true }) avatarUrl!: string | null;
  @ApiProperty({ enum: ActorRoleCode, isArray: true })
  roles!: ActorRoleCode[];
  @ApiProperty({ enum: WorkflowActionCode, isArray: true })
  permissions!: WorkflowActionCode[];
}

export class TokenPairResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ example: 'Bearer' }) tokenType!: 'Bearer';
  @ApiProperty({
    example: 900,
    description: 'Access-token lifetime in seconds',
  })
  expiresIn!: number;
}

export class LoginResponseDto {
  @ApiProperty({ type: AuthUserResponseDto }) user!: AuthUserResponseDto;
  @ApiProperty({ type: TokenPairResponseDto }) tokens!: TokenPairResponseDto;
}

export class RefreshResponseDto {
  @ApiProperty({ type: TokenPairResponseDto }) tokens!: TokenPairResponseDto;
}
