import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CargoCodeInputDto } from '../cargo-code/dtos/cargo-code.dto';
import { PodCodeInputDto } from '../pod-code/dtos/pod-code.dto';
import { VesselCodeInputDto } from '../vessel-code/dtos/vessel-code.dto';
import { PolCodeInputDto, PolCodeResponseDto } from './dtos/pol-code.dto';

async function errorsFor(dto: object): Promise<string[]> {
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((error) => error.property);
}

describe('Reference Data DTO contracts', () => {
  it('rejects POL caller code, tenant, and OptionType fields and exposes no code response property', async () => {
    const input = plainToInstance(PolCodeInputDto, {
      name: ' Korea ',
      code: '01',
      tenantId: 'tenant-a',
      optionType: 'POL',
    });
    expect(await errorsFor(input)).toEqual(
      expect.arrayContaining(['code', 'tenantId', 'optionType']),
    );
    expect(input.name).toBe('Korea');
    expect(
      Object.getOwnPropertyNames(PolCodeResponseDto.prototype),
    ).not.toContain('code');
  });

  it('rejects POD caller code, tenant, and OptionType fields', async () => {
    const input = plainToInstance(PodCodeInputDto, {
      name: ' Mexico ',
      code: '01',
      tenantId: 'tenant-a',
      optionType: 'POD',
    });
    expect(await errorsFor(input)).toEqual(
      expect.arrayContaining(['code', 'tenantId', 'optionType']),
    );
    expect(input.name).toBe('Mexico');
  });

  it('trims Cargo and Vessel names and uppercases their codes', () => {
    const cargo = plainToInstance(CargoCodeInputDto, {
      name: ' Crane ',
      code: ' cra ',
    });
    const vessel = plainToInstance(VesselCodeInputDto, {
      name: ' Fixture Vessel ',
      code: ' ca2 ',
    });
    expect(cargo).toMatchObject({ name: 'Crane', code: 'CRA' });
    expect(vessel).toMatchObject({ name: 'Fixture Vessel', code: 'CA2' });
  });
});
