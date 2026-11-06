import 'reflect-metadata';
import { SELF_DECLARED_DEPS_METADATA } from '@nestjs/common/constants';
import { FILE_STORAGE } from '../contracts/storage/file-storage.port';
import { WorkRequestService } from './work-request.service';

describe('WorkRequestService dependency injection', () => {
  it('binds FILE_STORAGE only to its concrete storage parameter', () => {
    expect(
      Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, WorkRequestService),
    ).toEqual([{ index: 16, param: FILE_STORAGE }]);
  });
});
