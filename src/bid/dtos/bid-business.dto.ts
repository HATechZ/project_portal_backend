import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BidBusinessOutcomeInput {
  WON = 'WON',
  REJECTED = 'REJECTED',
}

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class DecideBidBusinessOutcomeDto {
  @ApiProperty({ enum: BidBusinessOutcomeInput })
  @IsEnum(BidBusinessOutcomeInput)
  outcome!: BidBusinessOutcomeInput;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note?: string;
}

export class BidArchivedReviewRequestDto {
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note?: string;
}

export class RestoreBidDto {
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note?: string;
}

export class BidBusinessReadinessResponseDto {
  @ApiProperty() ready!: boolean;
  @ApiProperty({ nullable: true, format: 'uuid' }) currentCycleId!: string | null;
  @ApiProperty() totalWorkRequests!: number;
  @ApiProperty() acceptedWorkRequests!: number;
  @ApiProperty({ type: String, isArray: true }) blocking!: string[];
}

export class BidBusinessCommandResponseDto {
  @ApiProperty({ format: 'uuid' }) bidId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) cycleId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) outcomeId!: string | null;
  @ApiPropertyOptional({ format: 'uuid' }) directProjectId?: string;
  @ApiPropertyOptional() directProjectName?: string;
  @ApiPropertyOptional() directProjectCode?: string;
  @ApiPropertyOptional() cycleNumber?: number;
  @ApiPropertyOptional({ format: 'uuid' }) reviewRequestId?: string;
}

export class BidBusinessHistoryResponseDto {
  @ApiProperty({ format: 'uuid' }) bidId!: string;
  @ApiProperty({ type: Object, isArray: true }) cycles!: object[];
  @ApiProperty({ type: Object, isArray: true }) outcomes!: object[];
  @ApiPropertyOptional({ type: Object, nullable: true }) conversion!: object | null;
}
