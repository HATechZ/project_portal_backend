import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomRoleScope, PermissionCode } from '../../generated/prisma/client';

export class AuthUserResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Tenant Super Administrator' }) fullName!: string;
  @ApiProperty({ example: 'admin@project-portal.local' }) email!: string;
  @ApiPropertyOptional({ nullable: true }) country!: string | null;
  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
  @ApiPropertyOptional({ nullable: true }) avatarUrl!: string | null;
  @ApiProperty({
    type: String,
    isArray: true,
    description: 'Legacy display labels only; they do not authorize requests.',
  })
  roles!: string[];
  @ApiProperty({ enum: CustomRoleScope, isArray: true })
  roleScopes!: CustomRoleScope[];
  @ApiProperty({ enum: PermissionCode, isArray: true })
  permissions!: PermissionCode[];
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
