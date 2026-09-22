import {
  assertProjectUploadAllowed,
  safeProjectOriginalName,
} from './project-upload-policy';

describe('Project upload policy', () => {
  it('requires a matching approved extension and MIME type', () => {
    expect(() =>
      assertProjectUploadAllowed({
        originalname: 'drawing.dwg',
        mimetype: 'image/vnd.dwg',
      }),
    ).not.toThrow();
    expect(() =>
      assertProjectUploadAllowed({
        originalname: 'drawing.dwg',
        mimetype: 'application/pdf',
      }),
    ).toThrow();
    expect(() =>
      assertProjectUploadAllowed({
        originalname: 'payload.exe',
        mimetype: 'application/octet-stream',
      }),
    ).toThrow();
  });
  it('preserves only the basename as original filename metadata', () => {
    expect(safeProjectOriginalName('../plan.pdf')).toBe('plan.pdf');
  });
});
