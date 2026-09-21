import { Module } from '@nestjs/common';
import { DesignationController } from './designation.controller';
import { DesignationService } from './designation.service';
import { DesignationRepository } from './repositories';

@Module({
  controllers: [DesignationController],
  providers: [DesignationService, DesignationRepository],
})
export class DesignationModule {}
