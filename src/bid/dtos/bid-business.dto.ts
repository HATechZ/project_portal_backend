import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
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
  @ApiProperty({ nullable: true, format: 'uuid' }) currentCycleId!:
    string | null;
  @ApiProperty() totalWorkRequests!: number;
  @ApiProperty() acceptedWorkRequests!: number;
  @ApiProperty({ type: String, isArray: true }) blocking!: string[];
}

export enum BidAvailableActionCode {
  UPDATE_BID = 'UPDATE_BID',
  DECIDE_BID_WON = 'DECIDE_BID_WON',
  DECIDE_BID_REJECTED = 'DECIDE_BID_REJECTED',
  REQUEST_ARCHIVED_BID_REVIEW = 'REQUEST_ARCHIVED_BID_REVIEW',
  RESTORE_BID = 'RESTORE_BID',
}

export class BidAvailableActionDto {
  @ApiProperty({ enum: BidAvailableActionCode })
  code!: BidAvailableActionCode;
  @ApiProperty()
  label!: string;
}

export class BidAvailableActionsResponseDto {
  @ApiProperty({ format: 'uuid' }) bidId!: string;
  @ApiProperty() workflowState!: string;
  @ApiProperty({ type: () => BidAvailableActionDto, isArray: true })
  availableActions!: BidAvailableActionDto[];
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
  @ApiPropertyOptional({ type: Object, nullable: true }) conversion!:
    object | null;
}
