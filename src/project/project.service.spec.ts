/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { RequestContext } from '../common/context/request-context';
import { ProjectService } from './project.service';

describe('ProjectService', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const actorId = '22222222-2222-4222-8222-222222222222';
  const clientId = '33333333-3333-4333-8333-333333333333';
  const record: any = {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Ocean Transport',
    clientId,
    createdAt: new Date(),
    updatedAt: new Date(),
    statusEvents: [{ toStatus: { code: 'ACTIVE' } }],
    documents: [],
    _count: { documents: 0 },
  };
  function service(overrides: any = {}) {
    const repository: any = {
      documentCodes: jest.fn().mockResolvedValue(new Map()),
      create: jest.fn().mockResolvedValue(record),
      rename: jest.fn().mockResolvedValue(record),
      reclassifyDocument: jest.fn(),
      ...overrides.repository,
    };
    const uow: any = { execute: jest.fn((work) => work()) };
    const outbox: any = { enqueue: jest.fn() };
    const cleanup: any = { enqueue: jest.fn() };
    const storage: any = { put: jest.fn(), remove: jest.fn() };
    return {
      target: new ProjectService(repository, uow, outbox, cleanup, storage),
      repository,
      outbox,
      cleanup,
      storage,
    };
  }
  it('writes ACTIVE and created events in the same UoW callback as the Project', async () => {
    const { target, repository, outbox } = service();
    await RequestContext.run({ requestId: 'r', tenantId }, () =>
      target.create({ name: 'Ocean Transport', clientId }, [], actorId),
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ normalizedName: 'ocean transport', files: [] }),
    );
    expect(outbox.enqueue).toHaveBeenCalledTimes(2);
  });
  it('does not enqueue an outbox event when the Project transaction fails', async () => {
    const { target, outbox } = service({
      repository: {
        create: jest.fn().mockRejectedValue(new Error('rollback')),
      },
    });
    await expect(
      RequestContext.run({ requestId: 'r', tenantId }, () =>
        target.create({ name: 'Ocean Transport', clientId }, [], actorId),
      ),
    ).rejects.toThrow('rollback');
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
  it('queues failed storage compensation without treating the file as a Project document', async () => {
    const codeId = '77777777-7777-4777-8777-777777777777';
    const { target, cleanup, storage } = service({
      repository: {
        documentCodes: jest.fn().mockResolvedValue(new Map([[codeId, '100']])),
        create: jest.fn().mockRejectedValue(new Error('db failed')),
      },
    });
    storage.remove.mockRejectedValue(new Error('locked'));
    await expect(
      RequestContext.run({ requestId: 'r', tenantId }, () =>
        target.create(
          {
            name: 'Ocean Transport',
            clientId,
          },
          [
            {
              fieldname: 'files',
              originalname: 'plan.pdf',
              mimetype: 'application/pdf',
              size: 1,
              buffer: Buffer.from('x'),
            },
          ],
          actorId,
          [codeId],
        ),
      ),
    ).rejects.toThrow('db failed');
    expect(cleanup.enqueue).toHaveBeenCalledWith(
      expect.stringContaining('/projects/'),
      expect.any(Error),
    );
  });
  it('preserves bytes identity while recording per-file code reclassification and its outbox event', async () => {
    const changed = {
      id: 'd',
      originalFileName: 'plan.pdf',
      storageKey: 'tenants/t/projects/p/documents/f.pdf',
      generatedFileName: null,
      documentCodeOptionId: '55555555-5555-4555-8555-555555555555',
    };
    const { target, repository, outbox } = service({
      repository: { reclassifyDocument: jest.fn().mockResolvedValue(changed) },
    });
    await RequestContext.run({ requestId: 'r', tenantId }, () =>
      target.reclassifyDocument(
        record.id,
        '66666666-6666-4666-8666-666666666666',
        { documentCodeOptionId: changed.documentCodeOptionId },
        actorId,
      ),
    );
    expect(repository.reclassifyDocument).toHaveBeenCalled();
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });
});
