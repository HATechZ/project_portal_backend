import { Injectable } from '@nestjs/common';
import { CargoCodeRepository } from './repositories/cargo-code.repository';
import { CargoCodeServiceBase } from './providers/cargo-code.service-base';
@Injectable()
export class CargoCodeService extends CargoCodeServiceBase {
  constructor(v: CargoCodeRepository) {
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
