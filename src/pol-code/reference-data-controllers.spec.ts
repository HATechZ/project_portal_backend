/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { FINAL_PERMISSIONS_KEY } from '../common/security/final-permissions.decorator';
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
import { PermissionCode } from '../generated/prisma/client';
import { CargoCodeController } from '../cargo-code/cargo-code.controller';
import { PodCodeController } from '../pod-code/pod-code.controller';
import { VesselCodeController } from '../vessel-code/vessel-code.controller';
import { PolCodeController } from './pol-code.controller';

const controllers = [
  ['pol-codes', PolCodeController],
  ['pod-codes', PodCodeController],
  ['cargo-codes', CargoCodeController],
  ['vessel-codes', VesselCodeController],
] as const;

const expectedRoutes = [
  [RequestMethod.GET, '/'],
  [RequestMethod.GET, 'deactivated'],
  [RequestMethod.GET, ':id'],
  [RequestMethod.POST, '/'],
  [RequestMethod.PATCH, ':id'],
  [RequestMethod.PATCH, ':id/deactivate'],
  [RequestMethod.PATCH, ':id/reactivate'],
];

describe.each(controllers)('%s controller contract', (_path, Controller) => {
  it('declares final atomic permissions and the deactivated-list lifecycle without delete', () => {
    const prototype = Controller.prototype;
    const routes = Object.getOwnPropertyNames(prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => [
        Reflect.getMetadata(METHOD_METADATA, prototype[name]),
        Reflect.getMetadata(PATH_METADATA, prototype[name]) ?? '/',
      ]);

    expect(Reflect.getMetadata(GUARDS_METADATA, Controller)).toContain(
      FinalPermissionsGuard,
    );
    expect(
      Reflect.getMetadata(FINAL_PERMISSIONS_KEY, prototype.findAll),
    ).toEqual([PermissionCode.VIEW_REFERENCE_DATA]);
    expect(
      Reflect.getMetadata(FINAL_PERMISSIONS_KEY, prototype.create),
    ).toEqual([PermissionCode.CREATE_REFERENCE_DATA_OPTION]);
    expect(routes).toEqual(expectedRoutes);
    expect(Object.getOwnPropertyNames(prototype)).not.toContain('delete');
  });
});

describe('Reference Data Swagger contracts', () => {
  const controllerSources = [
    [
      'src/pol-code/pol-code.controller.ts',
      'pol-codes',
      'POL',
      'POL Code OptionValue ID',
      'PolCodeResponseDto',
    ],
    [
      'src/pod-code/pod-code.controller.ts',
      'pod-codes',
      'POD',
      'POD Code OptionValue ID',
      'PodCodeResponseDto',
    ],
    [
      'src/cargo-code/cargo-code.controller.ts',
      'cargo-codes',
      'cargo',
      'Cargo Code OptionValue ID',
      'CargoCodeResponseDto',
    ],
    [
      'src/vessel-code/vessel-code.controller.ts',
      'vessel-codes',
      'vessel',
      'Vessel Code OptionValue ID',
      'VesselCodeResponseDto',
    ],
  ] as const;

  it.each(controllerSources)(
    'documents the %s lifecycle with tag, summaries, ID parameter, and response body',
    (path, tag, label, idDescription, responseDto) => {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8');

      expect(source).toContain(`@ApiTags('${tag}')`);
      expect(source).toContain(`List all ${label} codes`);
      expect(source).toContain(`List deactivated ${label} codes`);
      expect(source).toContain(`Create a new ${label} code`);
      expect(source).toContain(`Get ${label} code by ID`);
      expect(source).toContain(`Update ${label} code by ID`);
      expect(source).toContain(`Deactivate ${label} code by ID`);
      expect(source).toContain(`Reactivate ${label} code by ID`);
      expect(source.match(new RegExp(idDescription, 'g'))).toHaveLength(4);
      expect(source.match(new RegExp(responseDto, 'g'))).toHaveLength(8);
      expect(
        source.match(/@ApiStandard(?:Array|Created|Ok)Response/g),
      ).toHaveLength(7);
      expect(source.match(/@ApiStandardBadRequestResponse\(\)/g)).toHaveLength(
        1,
      );
      expect(
        source.match(/@ApiStandardUnauthorizedResponse\(\)/g),
      ).toHaveLength(1);
      expect(source.match(/@ApiStandardForbiddenResponse\(\)/g)).toHaveLength(
        1,
      );
      expect(source.match(/@ApiStandardNotFoundResponse/g)).toHaveLength(4);
      expect(source.match(/@ApiStandardConflictResponse/g)).toHaveLength(4);
      expect(source.match(/@ResponseMessage\(/g)).toHaveLength(7);
    },
  );
});
