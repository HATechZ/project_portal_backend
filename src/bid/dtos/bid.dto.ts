import { Transform, Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsDefined,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class BidInfoDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  biddingNumber!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  polId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  podId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cargoId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vesselId!: string;

  @ApiProperty({ maxLength: 10 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  shipmentNumber!: string;
}

export class CreateBidDto {
  @ApiProperty({ maxLength: 220 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(220)
  name!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientId!: string;

  @ApiProperty({ type: BidInfoDto })
  @IsDefined()
  @Type(() => BidInfoDto)
  @ValidateNested()
  bidInfo!: BidInfoDto;

  @ApiPropertyOptional({ type: () => BidDocumentInputDto, isArray: true })
  @IsOptional()
  @Type(() => BidDocumentInputDto)
  @ValidateNested({ each: true })
  documents?: BidDocumentInputDto[];
}

/** Public JSON request for POST /bids. File upload is a separate endpoint. */
export class CreateBidRequestDto {
  @ApiProperty({ maxLength: 220 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(220)
  name!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() clientId!: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  biddingNumber!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() polId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() podId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() cargoId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() vesselId!: string;
  @ApiProperty({ maxLength: 10 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  shipmentNumber!: string;
}

const multipartArray = ({ value }: { value: unknown }) =>
  value === undefined || value === ''
    ? undefined
    : Array.isArray(value)
      ? value
      : [value];

/** Flat multipart contract for POST /bids; files are supplied separately. */
export class CreateBidMultipartDto {
  @ApiProperty({ example: 'Salina' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(220)
  name!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() clientId!: string;
  @ApiProperty({ example: '21128' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  biddingNumber!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() polId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() podId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() cargoId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() vesselId!: string;
  @ApiProperty({ example: '01' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  shipmentNumber!: string;
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    isArray: true,
    description: 'One Document Code ID for each uploaded file, in file order.',
  })
  @IsOptional()
  @Transform(multipartArray)
  @IsUUID(undefined, { each: true })
  documentCodeIds?: string[];
}

export class DocumentUploadMetadataDto {
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) fileIndex!: number;
  @ApiProperty({ format: 'uuid' }) @IsUUID() documentCodeId!: string;
}

export class BidDocumentInputDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  fileIndex!: number;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  documentCodeId!: string;
}

export class UpdateBidDto {
  @ApiPropertyOptional({ maxLength: 220 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(220)
  name?: string;
}

export class BidFileMetadataDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  documentCodeId!: string;
}

export class ReclassifyBidDocumentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  documentCodeId!: string;
}

export class ReclassifiedBidDocumentResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() originalFileName!: string;
  @ApiProperty() generatedFileName!: string;
  @ApiProperty({ format: 'uuid' }) documentCodeId!: string;
}

export class BidResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() projectCode!: string;
  @ApiProperty() biddingNumber!: string;
  @ApiProperty() shipmentNumber!: string;
  @ApiProperty() status!: string;
  @ApiProperty() clientId!: string;
  @ApiProperty() client!: { id: string; name: string };
  @ApiProperty() fileCount!: number;
  @ApiProperty({ type: () => BidDocumentResponseDto, isArray: true })
  documents!: BidDocumentResponseDto[];
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
export class BidDocumentResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) documentCodeId!: string;
  @ApiProperty() originalFileName!: string;
  @ApiProperty() generatedFileName!: string;
  @ApiProperty() storageKey!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() size!: number;
}
