import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('API response Swagger contracts', () => {
  it('documents the shared version MIME type and size without checksum', () => {
    const dto = source('src/common/documents/document-summary.dto.ts');
    expect(dto).toContain('@ApiProperty() mimeType!: string;');
    expect(dto).toContain('@ApiProperty() size!: number;');
    expect(dto).not.toContain('checksum');
  });

  it.each([
    'src/bid/bid.controller.ts',
    'src/project/project.controller.ts',
    'src/work-request/work-request-document.controller.ts',
  ])('%s documents document collections as arrays', (path) => {
    const controller = source(path);

    expect(controller).toContain('@ApiStandardCreatedArrayResponse(');
    expect(controller).toContain('DocumentSummaryDto');
    expect(controller).toMatch(
      /@ApiStandardArrayResponse\(\s*DocumentSummaryDto/,
    );
    expect(controller).toMatch(
      /@ApiStandardArrayResponse\(\s*DocumentVersionResponseDto/,
    );
  });

  it('documents array and explicit Work Request read contracts', () => {
    expect(source('src/member/member.controller.ts')).toContain(
      '@ApiStandardArrayResponse(LedDivisionResponseDto',
    );
    expect(source('src/team/team-membership.controller.ts')).toContain(
      '@ApiStandardArrayResponse(TeamMemberResponseDto',
    );

    const assignments = source(
      'src/work-request/work-request-assignment.controller.ts',
    );
    expect(assignments).toContain(
      '@ApiStandardArrayResponse(WorkRequestAssignmentHistoryResponseDto)',
    );

    const history = source('src/work-request/work-request-history.controller.ts');
    expect(history).toContain('@ApiPaginatedResponse(WorkRequestEventResponseDto)');
    expect(history).toContain(
      '@ApiStandardArrayResponse(WorkRequestAvailableActionResponseDto)',
    );
    expect(history).toContain('@ApiStandardNotFoundResponse');

    expect(source('src/work-request/work-request.controller.ts')).toContain(
      "@ApiStandardOkResponse(WorkRequestResponseDto, 'Work Request updated')",
    );
  });

  it('documents the accepted auth and root API success responses', () => {
    expect(source('src/auth/auth.controller.ts')).toContain(
      '@ApiStandardAcceptedResponse(',
    );
    expect(source('src/app.controller.ts')).toContain(
      '@ApiStandardOkResponse(String,',
    );
  });
});
