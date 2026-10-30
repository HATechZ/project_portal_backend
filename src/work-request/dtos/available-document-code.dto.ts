import { ApiProperty } from '@nestjs/swagger';
import { DocumentGroupCode } from '../../generated/prisma/client';

export class AvailableDocumentCodeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: DocumentGroupCode })
  documentGroup!: DocumentGroupCode;
}
