import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DocumentSummaryDto {
  @ApiProperty({ format: 'uuid' }) documentId!: string;
  @ApiProperty() owner!: {
    kind: 'BID' | 'PROJECT' | 'WORK_REQUEST';
    id: string;
  };
  @ApiProperty() documentCode!: { id: string; code: string; name: string };
  @ApiProperty() originalFileName!: string;
  @ApiProperty() generatedFileName!: string;
  @ApiPropertyOptional({ nullable: true }) description?: string | null;
  @ApiPropertyOptional({ nullable: true }) shipmentNumber?: string | null;
  @ApiProperty() mimeType!: string;
  @ApiProperty() size!: number;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  lastUpdatedAt?: Date | null;
  @ApiProperty() latestVersion!: {
    versionId: string;
    versionNumber: number;
    revisionCode: string;
    uploadedFileName: string;
    generatedFileName: string;
    mimeType: string;
    size: number;
    uploadedBy: { id: string; label: string };
    uploadedAt: Date;
  };
}

export class DocumentVersionResponseDto {
  @ApiProperty({ format: 'uuid' }) documentId!: string;
  @ApiProperty({ format: 'uuid' }) versionId!: string;
  @ApiProperty() versionNumber!: number;
  @ApiProperty() revisionCode!: string;
  @ApiProperty() uploadedFileName!: string;
  @ApiProperty() generatedFileName!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() size!: number;
  @ApiProperty() uploadedBy!: { id: string; label: string };
  @ApiProperty() uploadedAt!: Date;
}
