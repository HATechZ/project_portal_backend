import { ValidationPipe } from '@nestjs/common';
import { CreateClientDto } from './create-client.dto';

describe('CreateClientDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

  it('rejects caller-controlled tenant and password fields', async () => {
    await expect(pipe.transform({
      name: 'DEME',
      primaryContact: { name: 'John Smith', email: 'john@example.com' },
      enablePortalAccess: true,
      tenantId: 'tenant-id',
      password: 'not-allowed',
    }, { type: 'body', metatype: CreateClientDto })).rejects.toThrow();
  });

  it('accepts the approved business input', async () => {
    await expect(pipe.transform({
      name: 'DEME',
      primaryContact: { name: 'John Smith', email: 'john@example.com', phone: '+8801712345678' },
      enablePortalAccess: true,
    }, { type: 'body', metatype: CreateClientDto })).resolves.toBeInstanceOf(CreateClientDto);
  });
});
