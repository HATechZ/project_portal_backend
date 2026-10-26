import { workRequestCreateMultipartBody } from './work-request.swagger';

type ParentRequirement = {
  required: string[];
};

describe('Work Request multipart OpenAPI contract', () => {
  const schema = workRequestCreateMultipartBody.schema as {
    required: string[];
    properties: Record<string, unknown>;
    oneOf: ParentRequirement[];
  };

  it('keeps both parent fields visible with only title and priority globally required', () => {
    expect(schema.properties).toEqual(
      expect.objectContaining({
        bidId: expect.any(Object) as unknown,
        projectId: expect.any(Object) as unknown,
      }),
    );
    expect(schema.required).toEqual([
      'title',
      'priority',
      'originatingDivisionId',
      'intermediateDivisionIds',
    ]);
    expect(schema.required).not.toContain('bidId');
    expect(schema.required).not.toContain('projectId');
  });

  it('expresses the parent XOR with oneOf required constraints', () => {
    expect(schema.oneOf).toEqual([
      { required: ['bidId'] },
      { required: ['projectId'] },
    ]);
  });

  it('keeps files and document code IDs optional', () => {
    expect(schema.required).not.toContain('files');
    expect(schema.required).not.toContain('documentCodeIds');
    expect(schema.properties).toEqual(
      expect.objectContaining({
        files: expect.any(Object) as unknown,
        documentCodeIds: expect.any(Object) as unknown,
      }),
    );
  });

  it('documents optional per-file metadata with repeated multipart fields', () => {
    expect(schema.properties).toEqual(
      expect.objectContaining({
        descriptions: expect.objectContaining({ type: 'array' }) as unknown,
        shipmentNumbers: expect.objectContaining({ type: 'array' }) as unknown,
      }),
    );
  });

  it('documents the route-required multipart fields and file cardinality', () => {
    const files = schema.properties.files;
    expect(schema.properties).toEqual(
      expect.objectContaining({
        originatingDivisionId: { type: 'string', format: 'uuid' },
        intermediateDivisionIds: {
          type: 'array',
          minItems: 1,
          items: { type: 'string', format: 'uuid' },
        },
      }),
    );
    expect(files).toEqual(
      expect.objectContaining({
        type: 'array',
        maxItems: 20,
        items: { type: 'string', format: 'binary' },
      }),
    );
  });
});
