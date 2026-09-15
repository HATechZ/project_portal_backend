import { Module } from '@nestjs/common';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';
import {
  ClientAccessRepository,
  ClientContactRepository,
  ClientOnboardingRepository,
  ClientRepository,
} from './repositories';

@Module({
  controllers: [ClientController],
  providers: [
    ClientService,
    ClientRepository,
    ClientContactRepository,
    ClientOnboardingRepository,
    ClientAccessRepository,
  ],
})
export class ClientModule {}
