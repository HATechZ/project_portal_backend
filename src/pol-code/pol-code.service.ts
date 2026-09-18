import { Injectable } from '@nestjs/common';
import { ActorScopeContext } from '../common/security/object-scope.provider';
import { PolCodeRepository } from './repositories/pol-code.repository';
import { PolCodeServiceBase } from './providers/pol-code.service-base';
@Injectable()
export class PolCodeService extends PolCodeServiceBase {
  constructor(values: PolCodeRepository) {
    super(values, false);
  }
  findAll(inactive = false) {
    return this.list(inactive).then((rows) =>
      rows.map((row) => PolCodeServiceBase.row(row, false)),
    );
  }
  findOne(id: string) {
    return this.one(id).then((row) => PolCodeServiceBase.row(row, false));
  }
  create(input: { name: string }, scope: ActorScopeContext) {
    return super
      .createValue(input, scope)
      .then((row) => PolCodeServiceBase.row(row, false));
  }
  update(id: string, input: { name?: string }, scope: ActorScopeContext) {
    return super
      .updateValue(id, input, scope)
      .then((row) => PolCodeServiceBase.row(row, false));
  }
  deactivate(id: string, scope: ActorScopeContext) {
    return super
      .lifecycleValue(id, false, scope)
      .then((row) => PolCodeServiceBase.row(row, false));
  }
  reactivate(id: string, scope: ActorScopeContext) {
    return super
      .lifecycleValue(id, true, scope)
      .then((row) => PolCodeServiceBase.row(row, false));
  }
}
