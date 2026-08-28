import { Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

class EnvelopeMetaSchema {
  @ApiProperty({ required: false }) requestId?: string;
  @ApiProperty({ format: 'date-time' }) timestamp!: string;
}

export function wrapEnvelope<T>(model: Type<T>): Type<unknown> {
  class EnvelopeSchema {
    @ApiProperty({ example: true }) success!: true;
    @ApiProperty({ type: model }) data!: T;
    @ApiProperty({ type: EnvelopeMetaSchema }) meta!: EnvelopeMetaSchema;
  }
  Object.defineProperty(EnvelopeSchema, 'name', {
    value: `${model.name}Envelope`,
  });
  return EnvelopeSchema;
}
