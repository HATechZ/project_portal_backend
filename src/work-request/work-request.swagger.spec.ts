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
    expect(schema.required).toEqual(['title', 'priority']);
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
});
