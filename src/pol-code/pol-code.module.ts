import { Module } from '@nestjs/common';
import { PolCodeRepository } from './repositories/pol-code.repository';
import { PolCodeController } from './pol-code.controller';
import { PolCodeService } from './pol-code.service';
@Module({
  controllers: [PolCodeController],
  providers: [PolCodeService, PolCodeRepository],
})
export class PolCodeModule {}
