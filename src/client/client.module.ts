import { Module } from '@nestjs/common';
import { ClientContactController } from './client-contact.controller';
import { ClientContactService } from './client-contact.service';
import { ClientPortalAccessController } from './client-portal-access.controller';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';
import { ClientScopeProvider } from './providers';
import {
  ClientAccessRepository,
  ClientContactRepository,
  ClientOnboardingRepository,
  ClientRepository,
} from './repositories';

@Module({
  controllers: [
    ClientController,
    ClientContactController,
    ClientPortalAccessController,
  ],
  providers: [
    ClientService,
    ClientContactService,
    ClientScopeProvider,
    ClientRepository,
    ClientContactRepository,
    ClientOnboardingRepository,
    ClientAccessRepository,
  ],
})
export class ClientModule {}
