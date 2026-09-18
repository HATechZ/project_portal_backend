import { Module } from '@nestjs/common';
import { CargoCodeRepository } from './repositories/cargo-code.repository';
import { CargoCodeController } from './cargo-code.controller';
import { CargoCodeService } from './cargo-code.service';
@Module({
  controllers: [CargoCodeController],
  providers: [CargoCodeService, CargoCodeRepository],
})
export class CargoCodeModule {}
