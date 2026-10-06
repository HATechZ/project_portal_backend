import { Injectable } from '@nestjs/common';
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
  findDeactivated() {
    return this.listDeactivated().then((rows) =>
      rows.map((row) => PolCodeServiceBase.row(row, false)),
    );
  }
  findOne(id: string) {
    return this.one(id).then((row) => PolCodeServiceBase.row(row, false));
  }
  create(input: { name: string }) {
    return super
      .createValue(input)
      .then((row) => PolCodeServiceBase.row(row, false));
  }
  update(id: string, input: { name?: string }) {
    return super
      .updateValue(id, input)
      .then((row) => PolCodeServiceBase.row(row, false));
  }
  deactivate(id: string) {
    return super
      .lifecycleValue(id, false)
      .then((row) => PolCodeServiceBase.row(row, false));
  }
  reactivate(id: string) {
    return super
      .lifecycleValue(id, true)
      .then((row) => PolCodeServiceBase.row(row, false));
  }
}
