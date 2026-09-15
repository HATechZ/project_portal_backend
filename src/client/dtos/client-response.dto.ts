import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClientResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  companyId!: string | null;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  isActive!: boolean;
  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class ClientContactResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  userId!: string | null;
  @ApiProperty({ format: 'uuid' })
  clientId!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  email!: string;
  @ApiPropertyOptional({ nullable: true })
  designation!: string | null;
  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;
  @ApiProperty()
  isPrimary!: boolean;
  @ApiProperty()
  isActive!: boolean;
  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class ClientPortalAccessResponseDto {
  @ApiProperty({ type: ClientResponseDto })
  client!: Pick<ClientResponseDto, 'id' | 'name'>;
  @ApiProperty({ type: ClientContactResponseDto })
  clientContact!: Pick<
    ClientContactResponseDto,
    'id' | 'name' | 'email' | 'userId'
  >;
  @ApiProperty()
  portalAccess!: { role: 'client_owner'; scope: 'client'; active: boolean };
}
