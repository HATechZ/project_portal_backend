import { Injectable } from '@nestjs/common';
import { ActorScopeContext } from '../common/security/object-scope.provider';
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
  create(i: { name: string; code: string }, s: ActorScopeContext) {
    return super.createValue(i, s);
  }
  update(
    id: string,
    i: { name?: string; code?: string },
    s: ActorScopeContext,
  ) {
    return super.updateValue(id, i, s);
  }
  deactivate(id: string, s: ActorScopeContext) {
    return super.lifecycleValue(id, false, s);
  }
  reactivate(id: string, s: ActorScopeContext) {
    return super.lifecycleValue(id, true, s);
  }
}
