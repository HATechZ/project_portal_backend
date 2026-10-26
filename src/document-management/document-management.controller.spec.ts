import { PATH_METADATA } from '@nestjs/common/constants';
import { DocumentManagementController } from './document-management.controller';
import { DocumentManagementService } from './document-management.service';

describe('DocumentManagementController API contract', () => {
  const service = {
    tree: jest.fn(),
    search: jest.fn(),
    exact: jest.fn(),
    preview: jest.fn(),
    download: jest.fn(),
  };
  const controller = new DocumentManagementController(
    service as unknown as DocumentManagementService,
  );

  it('publishes the exact contracted routes and binds tree/search query contracts', async () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, DocumentManagementController),
    ).toBe('/');
    const methods = Object.getOwnPropertyNames(
      DocumentManagementController.prototype,
    );
    const paths = Object.fromEntries(
      methods
        .filter((name) => name !== 'constructor')
        .map((name) => [
          name,
          Reflect.getMetadata(
            PATH_METADATA,
            DocumentManagementController.prototype[name],
          ),
        ]),
    );
    expect(paths).toMatchObject({
      tree: 'documents/tree',
      children: 'documents/tree/:nodeId/children',
      search: 'documents/search',
      exact: 'document-versions/:versionId',
      preview: 'document-versions/:versionId/preview',
      download: 'document-versions/:versionId/download',
    });
    await controller.tree(
      { parentNodeId: 'root', cursor: 'cursor', limit: 2 },
      {} as never,
    );
    await controller.children(
      'node',
      { cursor: 'cursor', limit: 2 },
      {} as never,
    );
    await controller.search(
      { parentKind: 'BID', limit: 2, sort: 'uploadedAt:desc' },
      {} as never,
    );
    expect(service.tree).toHaveBeenNthCalledWith(
      1,
      { parentNodeId: 'root', cursor: 'cursor', limit: 2 },
      {},
    );
    expect(service.tree).toHaveBeenNthCalledWith(
      2,
      { parentNodeId: 'node', cursor: 'cursor', limit: 2 },
      {},
    );
    expect(service.search).toHaveBeenCalledWith(
      { parentKind: 'BID', limit: 2, sort: 'uploadedAt:desc' },
      {},
    );
  });
});
