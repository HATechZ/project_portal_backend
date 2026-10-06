import { Injectable } from '@nestjs/common';
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
  findDeactivated() {
    return this.listDeactivated().then((rs) =>
      rs.map((r) => PodCodeServiceBase.row(r, false)),
    );
  }
  findOne(id: string) {
    return this.one(id).then((r) => PodCodeServiceBase.row(r, false));
  }
  create(i: { name: string }) {
    return super.createValue(i).then((r) => PodCodeServiceBase.row(r, false));
  }
  update(id: string, i: { name?: string }) {
    return super
      .updateValue(id, i)
      .then((r) => PodCodeServiceBase.row(r, false));
  }
  deactivate(id: string) {
    return super
      .lifecycleValue(id, false)
      .then((r) => PodCodeServiceBase.row(r, false));
  }
  reactivate(id: string) {
    return super
      .lifecycleValue(id, true)
      .then((r) => PodCodeServiceBase.row(r, false));
  }
}
