import { Module } from '@nestjs/common';
import { DivisionController } from './division.controller';
import { DivisionService } from './division.service';
import { DivisionRepository } from './repositories';

@Module({
  controllers: [DivisionController],
  providers: [DivisionService, DivisionRepository],
})
export class DivisionModule {}
