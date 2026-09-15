import { Module } from '@nestjs/common';
import { DivisionController } from './division.controller';
import { DivisionLeadController } from './division-lead.controller';
import { DivisionService } from './division.service';
import { DivisionLeadRepository, DivisionRepository } from './repositories';

@Module({
  controllers: [DivisionController, DivisionLeadController],
  providers: [DivisionService, DivisionRepository, DivisionLeadRepository],
})
export class DivisionModule {}
