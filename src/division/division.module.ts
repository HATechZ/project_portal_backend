import { Module } from '@nestjs/common';
import { DivisionController } from './division.controller';
import { DivisionService } from './division.service';
import { DivisionLeadRepository, DivisionRepository } from './repositories';

@Module({
  controllers: [DivisionController],
  providers: [DivisionService, DivisionRepository, DivisionLeadRepository],
})
export class DivisionModule {}
