import { CreateProjectMultipartPipe } from './multipart-project.pipe';
describe('Project flat multipart pipe', () => {
  it('parses one multipart Document Code value as an array', () => {
    const value = new CreateProjectMultipartPipe().transform({
      name: 'Offshore Installation Project',
      clientId: '11111111-1111-4111-8111-111111111111',
      documentCodeIds: '66666666-6666-4666-8666-666666666666',
    });
    expect(value.documentCodeIds).toEqual([
      '66666666-6666-4666-8666-666666666666',
    ]);
  });
});
