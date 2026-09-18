import { Module } from '@nestjs/common';
import { VesselCodeRepository } from './repositories/vessel-code.repository';
import { VesselCodeController } from './vessel-code.controller';
import { VesselCodeService } from './vessel-code.service';
@Module({
  controllers: [VesselCodeController],
  providers: [VesselCodeService, VesselCodeRepository],
})
export class VesselCodeModule {}
