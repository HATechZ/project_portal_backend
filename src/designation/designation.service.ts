import { Injectable } from '@nestjs/common';
import { DesignationRepository } from './repositories';
import { DesignationServiceBase } from './providers/designation.service-base';

@Injectable()
export class DesignationService extends DesignationServiceBase {
  constructor(repository: DesignationRepository) {
    super(repository);
  }
}
