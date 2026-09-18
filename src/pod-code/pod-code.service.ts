import { Injectable } from '@nestjs/common';
import { ActorScopeContext } from '../common/security/object-scope.provider';
import { PodCodeRepository } from './repositories/pod-code.repository';
import { PodCodeServiceBase } from './providers/pod-code.service-base';
@Injectable()
export class PodCodeService extends PodCodeServiceBase {
  constructor(values: PodCodeRepository) {
    super(values, false);
  }
  findAll(i = false) {
    return this.list(i).then((rs) =>
      rs.map((r) => PodCodeServiceBase.row(r, false)),
    );
  }
  findOne(id: string) {
    return this.one(id).then((r) => PodCodeServiceBase.row(r, false));
  }
  create(i: { name: string }, s: ActorScopeContext) {
    return super
      .createValue(i, s)
      .then((r) => PodCodeServiceBase.row(r, false));
  }
  update(id: string, i: { name?: string }, s: ActorScopeContext) {
    return super
      .updateValue(id, i, s)
      .then((r) => PodCodeServiceBase.row(r, false));
  }
  deactivate(id: string, s: ActorScopeContext) {
    return super
      .lifecycleValue(id, false, s)
      .then((r) => PodCodeServiceBase.row(r, false));
  }
  reactivate(id: string, s: ActorScopeContext) {
    return super
      .lifecycleValue(id, true, s)
      .then((r) => PodCodeServiceBase.row(r, false));
  }
}
