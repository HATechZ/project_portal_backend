import { Module } from '@nestjs/common';
import { PodCodeRepository } from './repositories/pod-code.repository';
import { PodCodeController } from './pod-code.controller';
import { PodCodeService } from './pod-code.service';
@Module({
  controllers: [PodCodeController],
  providers: [PodCodeService, PodCodeRepository],
})
export class PodCodeModule {}
