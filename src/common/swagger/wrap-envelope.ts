import { Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

class EnvelopeMetaDto {
  @ApiProperty({ required: false }) requestId?: string;
  @ApiProperty({ format: 'date-time' }) timestamp!: string;
}

export function wrapEnvelope<T>(model: Type<T>): Type<unknown> {
  class EnvelopeDto {
    @ApiProperty({ example: true }) success!: true;
    @ApiProperty({ type: model }) data!: T;
    @ApiProperty({ type: EnvelopeMetaDto }) meta!: EnvelopeMetaDto;
  }
  Object.defineProperty(EnvelopeDto, 'name', {
    value: `${model.name}Envelope`,
  });
  return EnvelopeDto;
}
