import { Injectable } from '@nestjs/common';
import { VesselCodeRepository } from './repositories/vessel-code.repository';
import { VesselCodeServiceBase } from './providers/vessel-code.service-base';
@Injectable()
export class VesselCodeService extends VesselCodeServiceBase {
  constructor(v: VesselCodeRepository) {
    super(v, true);
  }
  findAll(i = false) {
    return this.list(i);
  }
  findDeactivated() {
    return this.listDeactivated();
  }
  findOne(id: string) {
    return this.one(id);
  }
  create(i: { name: string; code: string }) {
    return super.createValue(i);
  }
  update(id: string, i: { name?: string; code?: string }) {
    return super.updateValue(id, i);
  }
  deactivate(id: string) {
    return super.lifecycleValue(id, false);
  }
  reactivate(id: string) {
    return super.lifecycleValue(id, true);
  }
}
