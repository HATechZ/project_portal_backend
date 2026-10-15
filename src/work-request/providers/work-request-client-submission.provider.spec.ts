import { PermissionCode, WorkRequestV1AssignmentLevelCode as Level, WorkRequestV1StateCode as State } from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { WorkRequestClientSubmissionProvider } from './work-request-client-submission.provider';

const permissions = [
  PermissionCode.SUBMIT_FOR_EXTERNAL_REVIEW,
  PermissionCode.SUBMIT_CLIENT_REVISION,
  PermissionCode.ROUTE_FOR_REVIEW,
  PermissionCode.VIEW_WORK_REQUEST,
  PermissionCode.VIEW_DOCUMENT,
];
const actor = (memberId = 'external-a') => ({
  id: 'actor-a',
  role: { customScope: null, rolePermissions: permissions.map((code) => ({ revokedAt: null, permission: { code, scopeCompatibilities: [] } })) },
  member: { id: memberId, isActive: true, companyId: 'company-a', company: { isActive: true } },
}) as never;
const snapshot = (state: State, overrides = {}) => ({
  bid: { clientId: 'client-a', client: { companyId: 'company-a' } },
  directProject: null,
  events: [{ resultingState: state }],
  assignments: [
    { level: Level.EXTERNAL_REVIEW, memberId: 'external-a' },
    { level: Level.MEMBER, memberId: 'member-a' },
    { level: Level.CHECKING, memberId: 'checking-a' },
  ],
  clientSubmissions: state === State.CLIENT_REVISION_REQUESTED ? [{ id: 'submission-a', decision: { id: 'decision-a', decision: 'REQUEST_REVISION' } }] : [],
  ...overrides,
});
function subject(current = snapshot(State.FINAL_RELEASE)) {
  const repository = {
    findEventByIdempotencyKey: jest.fn().mockResolvedValue(null),
    prepare: jest.fn().mockResolvedValue(current),
    versions: jest.fn().mockResolvedValue([{ id: 'version-a' }]),
    memberCapabilities: jest.fn().mockResolvedValue([
      PermissionCode.VIEW_WORK_REQUEST,
      PermissionCode.VIEW_DOCUMENT,
      PermissionCode.SUBMIT_WORK_REQUEST,
    ]),
    createSubmission: jest.fn().mockResolvedValue({
      submission: { id: 'submission-a', submissionNumber: 1, submittedAt: new Date(), items: [{ documentVersionId: 'version-a' }], decision: null },
      event: { id: 'event-a', action: 'CLIENT_REVIEW_SUBMITTED', priorState: State.FINAL_RELEASE, resultingState: State.CLIENT_REVIEW, occurredAt: new Date() },
    }),
    decide: jest.fn(), route: jest.fn(), list: jest.fn().mockResolvedValue([]),
  };
  const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
  return { repository, outbox, provider: new WorkRequestClientSubmissionProvider(repository as never, { execute: (work: () => Promise<unknown>) => work() } as never, outbox as never) };
}

describe('WorkRequestClientSubmissionProvider', () => {
  it('creates an immutable exact-version submission and publishes after its event', async () => {
    const { provider, repository, outbox } = subject();
    await RequestContext.run({ tenantId: 'tenant-a', requestId: 'request-a' }, () => provider.submit('request-a', { documentVersionIds: ['version-a'] }, actor()));
    expect(repository.createSubmission).toHaveBeenCalledWith(expect.objectContaining({ versionIds: ['version-a'], resubmission: false }));
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });

  it('denies package submission without the exact EXTERNAL_REVIEW assignment', async () => {
    const { provider, repository } = subject(snapshot(State.FINAL_RELEASE, { assignments: [] }));
    await expect(RequestContext.run({ tenantId: 'tenant-a', requestId: 'request-a' }, () => provider.submit('request-a', { documentVersionIds: ['version-a'] }, actor()))).rejects.toThrow();
    expect(repository.createSubmission).not.toHaveBeenCalled();
  });

  it('revalidates destination capabilities when routing a client revision', async () => {
    const { provider, repository } = subject(snapshot(State.CLIENT_REVISION_REQUESTED));
    repository.memberCapabilities.mockResolvedValue([PermissionCode.VIEW_WORK_REQUEST]);
    await expect(RequestContext.run({ tenantId: 'tenant-a', requestId: 'request-a' }, () => provider.route('request-a', { destination: 'CHECKING' }, actor()))).rejects.toThrow('Destination assignee lacks required capabilities');
    expect(repository.route).not.toHaveBeenCalled();
  });

  it('does not submit a second effect for a duplicate idempotency key', async () => {
    const { provider, repository } = subject();
    repository.findEventByIdempotencyKey.mockResolvedValue({ id: 'event-a' });
    await expect(RequestContext.run({ tenantId: 'tenant-a', requestId: 'request-a' }, () => provider.submit('request-a', { documentVersionIds: ['version-a'] }, actor()))).rejects.toThrow('already been applied');
    expect(repository.createSubmission).not.toHaveBeenCalled();
  });
});
