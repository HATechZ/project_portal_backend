import {
  WorkflowActionCode,
  WorkRequestV1StateCode as State,
} from '../../generated/prisma/client';
import { WorkRequestInfoProvider } from './work-request-info.provider';
import { getFinalPermissionForWorkRequestAction } from './work-request-final-permission.mapper';
import { RequestContext } from '../../common/context/request-context';

describe('WorkRequestInfoProvider', () => {
  beforeEach(() => {
    jest.spyOn(RequestContext, 'requireTenantId').mockReturnValue('tenant-a');
  });
  const actor = (
    permission: WorkflowActionCode,
    customScope: string | null = null,
    boundTeamId = customScope === 'team' ? 'team-a' : null,
  ) =>
    ({
      id: 'actor-a',
      isActive: true,
      boundTeamId,
      role: {
        isSystemRole: customScope === null,
        customScope,
        systemRole: { systemCode: 'tenant_super_admin' },
        userRolesByRoleId: [{ teamId: boundTeamId }],
        rolePermissions: [
          {
            revokedAt: null,
            permission: {
              code: getFinalPermissionForWorkRequestAction(permission),
            },
          },
        ],
      },
      member: {
        id: 'member-a',
        companyId: 'company-a',
        isActive: true,
        company: { isActive: true },
        divisionLeadsByMemberId: [{ divisionId: 'division-a' }],
      },
    }) as never;

  const prepared = (targetTeamId = 'team-a', targetDivisionId = 'division-a') =>
    ({
      request: {
        events: [{ resultingState: State.MEMBER_ASSIGNED }],
        assignments: [
          { level: 'MEMBER', memberId: 'member-target' },
          { level: 'CHECKING', memberId: 'member-a' },
        ],
      },
      parent: {
        clientId: 'client-a',
        client: { companyId: 'company-a' },
      },
      target: {
        id: 'target-a',
        isActive: true,
        roleId: 'role-a',
        user: {
          isActive: true,
          userRolesByUserId: [{ roleId: 'role-a' }],
        },
        member: {
          id: 'member-target',
          isActive: true,
          company: { isActive: true },
          companyId: 'company-a',
          divisionId: targetDivisionId,
          teamMembersByMemberId: [
            { teamId: targetTeamId, team: { isActive: true } },
          ],
        },
        clientContact: null,
      },
    }) as never;

  const record = (snapshot: ReturnType<typeof prepared>) => ({
    id: 'info-a',
    parentInfoRequestId: null,
    requestedByActor: {
      id: 'actor-a',
      member: { id: 'member-a' },
      clientContact: null,
    },
    targetActor: {
      id: 'target-a',
      member: { id: 'member-target' },
      clientContact: null,
    },
    message: 'Clarify.',
    status: 'OPEN',
    stateAtRequest: State.MEMBER_ASSIGNED,
    requestedAt: new Date('2026-10-15T00:00:00.000Z'),
    closedAt: null,
    attachments: [],
    responses: [],
  });

  const subject = (snapshot = prepared()) => {
    snapshot.info = { requestedByActorId: 'actor-a', targetActorId: 'actor-a' };
    const repository = {
      prepare: jest.fn().mockResolvedValue(snapshot),
      create: jest
        .fn()
        .mockResolvedValue({ request: record(snapshot), duplicate: false }),
      respond: jest.fn().mockResolvedValue({
        kind: 'ok',
        response: {
          id: 'response-a',
          message: 'Response.',
          respondedAt: new Date('2026-10-15T00:00:00.000Z'),
          attachments: [],
        },
      }),
      history: jest.fn().mockResolvedValue([record(snapshot)]),
      hasInfoRelationship: jest.fn().mockResolvedValue({ id: 'info-a' }),
      hasDocumentVersions: jest.fn().mockResolvedValue(true),
      isRouteWorkRequest: jest.fn().mockResolvedValue(null),
      isActiveRouteLead: jest.fn().mockResolvedValue(false),
      isVisible: jest.fn().mockResolvedValue(true),
      eligibleRecipients: jest.fn().mockResolvedValue([
        {
          id: 'target-a',
          label: 'Target Lead',
          memberId: 'member-target',
          clientContactId: null,
        },
      ]),
    };
    const provider = new WorkRequestInfoProvider(
      repository as never,
      { execute: (work: () => Promise<unknown>) => work() } as never,
      { enqueue: jest.fn() } as never,
    );
    return { provider, repository };
  };

  it('projects current member, leadership, team and client presentation metadata', async () => {
    const { provider, repository } = subject();
    const division = { id: 'division-a', name: 'Engineering' };
    const team = { id: 'team-a', name: 'Design' };
    const member = {
      name: 'Alex', email: 'alex@example.test', division,
      designation: { id: 'designation-a', name: 'Engineer' },
      divisionLeadsByMemberId: [{ division }],
      teamsByLeadMemberId: [team], teamMembersByMemberId: [{ team }],
    };
    repository.eligibleRecipients.mockResolvedValue([
      { id: 'lead', label: 'Lead', memberId: 'member-lead', member, clientContactId: null },
      { id: 'worker', label: 'Worker', memberId: 'member-worker', member: { ...member, divisionLeadsByMemberId: [], teamsByLeadMemberId: [] }, clientContactId: null },
      { id: 'contact', label: 'Contact', memberId: null, clientContactId: 'contact-a', member: null, clientContact: { name: 'Client', email: 'client@example.test', client: { id: 'client-a', name: 'Client Co' } } },
    ] as never);
    const result = await provider.eligibleRecipients('request-a', actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO));
    expect(result[0]).toMatchObject({ memberId: 'member-lead', divisionId: 'division-a', divisionName: 'Engineering', designationId: 'designation-a', designationName: 'Engineer', email: 'alex@example.test', teamIds: ['team-a'], teamNames: ['Design'], relationshipContexts: expect.arrayContaining([{ kind: 'DIVISION_LEAD', ...division }, { kind: 'TEAM_LEAD', ...team }]) });
    expect(result[1]).toMatchObject({ memberId: 'member-worker', divisionId: 'division-a', designationName: 'Engineer', teamIds: ['team-a'], relationshipContexts: expect.arrayContaining([{ kind: 'TEAM_MEMBER', ...team }]) });
    expect(result[2]).toMatchObject({ memberId: null, email: 'client@example.test', divisionId: null, divisionName: null, designationId: null, designationName: null, teamIds: [], teamNames: [], recipientType: 'EXTERNAL_CLIENT_CONTACT' });
  });

  it('allows the addressed active ClientContact to respond before Division assignment', async () => {
    const snapshot = prepared();
    snapshot.request.events = [{ resultingState: State.CREATED }];
    snapshot.request.assignments = [];
    const { provider } = subject(snapshot);
    const contact = actor(WorkflowActionCode.RESPOND_WORKFLOW_INFO, 'client_contact');
    contact.role.rolePermissions[0].permission.scopeCompatibilities = [{ scope: 'client_contact' }];
    contact.clientContact = { isActive: true, clientId: 'client-a', client: { isActive: true } };
    await expect(provider.respond('request-a', 'info-a', { message: 'Details.' }, contact)).resolves.toEqual(expect.objectContaining({ message: 'Response.' }));
  });

  it.each([
    ['text only', { message: ' text ' }, 'text'],
    ['attachment only', { documentVersionIds: ['version-a'] }, ''],
    ['blank with attachment', { message: '   ', documentVersionIds: ['version-a'] }, ''],
    ['text and attachment', { message: ' text ', documentVersionIds: ['version-a'] }, 'text'],
  ])('creates a Request Info with %s', async (_label, input, expectedMessage) => {
    const { provider, repository } = subject();
    await provider.request('request-a', { targetActorId: 'target-a', ...input }, actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO));
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ message: expectedMessage, documentVersionIds: input.documentVersionIds }));
  });

  it.each([
    ['text only', { message: ' text ' }, 'text'],
    ['attachment only', { documentVersionIds: ['version-a'] }, ''],
    ['blank with attachment', { message: '   ', documentVersionIds: ['version-a'] }, ''],
    ['text and attachment', { message: ' text ', documentVersionIds: ['version-a'] }, 'text'],
  ])('responds to Request Info with %s', async (_label, input, expectedMessage) => {
    const { provider, repository } = subject();
    await provider.respond('request-a', 'info-a', input, actor(WorkflowActionCode.RESPOND_WORKFLOW_INFO));
    expect(repository.respond.mock.calls[0].slice(0, 5)).toEqual(['request-a', 'info-a', 'actor-a', expectedMessage, input.documentVersionIds]);
  });

  it.each([{}, { message: '   ', documentVersionIds: [] }])('rejects empty create and reply %j', async (input) => {
    const { provider, repository } = subject();
    await expect(provider.request('request-a', { targetActorId: 'target-a', ...input }, actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO))).rejects.toMatchObject({ status: 400 });
    await expect(provider.respond('request-a', 'info-a', input, actor(WorkflowActionCode.RESPOND_WORKFLOW_INFO))).rejects.toMatchObject({ status: 400 });
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.respond).not.toHaveBeenCalled();
  });

  it('does not turn system administration into a communication identity', async () => {
    const { provider, repository } = subject();
    const admin = actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO);
    admin.member = null;
    admin.role.isActive = true;
    admin.role.rolePermissions.push({ revokedAt: null, permission: { code: 'VIEW_WORK_REQUEST' } });
    repository.hasInfoRelationship.mockResolvedValue(null);
    await expect(provider.eligibleRecipients('request-a', admin)).resolves.toEqual([]);
    await expect(provider.history('request-a', admin)).resolves.toHaveLength(1);
    expect(repository.isVisible).toHaveBeenCalledWith('request-a', admin);
    await expect(provider.request('request-a', { targetActorId: 'target-a', message: 'Clarify' }, admin)).rejects.toMatchObject({ status: 403 });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('does not expose relationship recipients to an administrator without a communication identity', async () => {
    const { provider, repository } = subject();
    const admin = actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO);
    admin.member = null;
    admin.role.isActive = true;
    repository.isVisible.mockResolvedValue(false);
    await expect(provider.eligibleRecipients('request-a', admin)).resolves.toEqual([]);
  });

  it('does not allow administrator recipient reads without the explicit grant', async () => {
    const { provider, repository } = subject();
    const admin = actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO);
    admin.member = null;
    admin.role.isActive = true;
    admin.role.rolePermissions = [];
    await expect(provider.eligibleRecipients('request-a', admin)).rejects.toMatchObject({ status: 403 });
    expect(repository.isVisible).not.toHaveBeenCalled();
  });

  it('allows an addressed active route Lead to respond and restricts their history to their own requests', async () => {
    const snapshot = prepared();
    snapshot.request.assignments = [];
    const { provider, repository } = subject(snapshot);
    repository.isActiveRouteLead.mockResolvedValue(true);
    await expect(provider.respond('request-a', 'info-a', { message: 'Details.' }, actor(WorkflowActionCode.RESPOND_WORKFLOW_INFO))).resolves.toEqual(expect.objectContaining({ message: 'Response.' }));
    await provider.history('request-a', actor(WorkflowActionCode.RESPOND_WORKFLOW_INFO));
    expect(repository.history).toHaveBeenCalledWith('request-a', 'actor-a');
  });

  it('allows the exact addressed actor to respond without a broad response grant', async () => {
    const snapshot = prepared();
    snapshot.request.assignments = [];
    const { provider, repository } = subject(snapshot);
    const addressed = actor(WorkflowActionCode.RESPOND_WORKFLOW_INFO);
    addressed.role.rolePermissions = [];
    await expect(provider.respond('request-a', 'info-a', { message: 'Details.' }, addressed)).resolves.toEqual(expect.objectContaining({ message: 'Response.' }));
    expect(repository.respond).toHaveBeenCalled();
  });

  it.each(['requester', 'target', 'reciprocal participant'])(
    'allows a persisted %s to read only their own history without a broad permission or current assignment',
    async () => {
      const snapshot = prepared();
      snapshot.request.assignments = [];
      const { provider, repository } = subject(snapshot);
      const participant = actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO);
      participant.role.rolePermissions = [];
      await expect(provider.history('request-a', participant)).resolves.toHaveLength(1);
      expect(repository.hasInfoRelationship).toHaveBeenCalledWith('request-a', 'actor-a');
      expect(repository.history).toHaveBeenCalledWith('request-a', 'actor-a');
      expect(repository.isActiveRouteLead).not.toHaveBeenCalled();
    },
  );

  it('returns empty history to a valid initiator before their first Request Info row', async () => {
    const { provider, repository } = subject();
    repository.hasInfoRelationship.mockResolvedValue(null);
    repository.eligibleRecipients.mockResolvedValue([{ id: 'target-a' }]);

    await expect(
      provider.history('request-a', actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO)),
    ).resolves.toEqual([]);
    expect(repository.eligibleRecipients).toHaveBeenCalledWith('request-a', 'actor-a');
    expect(repository.history).not.toHaveBeenCalled();
  });

  it('keeps existing initiator history actor-scoped after their first Request Info row', async () => {
    const { provider, repository } = subject();

    await expect(
      provider.history('request-a', actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO)),
    ).resolves.toHaveLength(1);
    expect(repository.history).toHaveBeenCalledWith('request-a', 'actor-a');
    expect(repository.eligibleRecipients).not.toHaveBeenCalled();
  });

  it('denies a new actor without Request Info permission even when recipients would exist', async () => {
    const { provider, repository } = subject();
    repository.hasInfoRelationship.mockResolvedValue(null);
    const noPermission = actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO);
    noPermission.role.rolePermissions = [];

    await expect(provider.history('request-a', noPermission)).rejects.toMatchObject({ status: 403 });
    expect(repository.eligibleRecipients).not.toHaveBeenCalled();
  });

  it('denies unrelated actors and administrative actors without an explicit history grant', async () => {
    const { provider, repository } = subject();
    repository.hasInfoRelationship.mockResolvedValue(null);
    repository.eligibleRecipients.mockResolvedValue([]);
    const unrelated = actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO, 'member');
    await expect(provider.history('request-a', unrelated)).rejects.toMatchObject({ status: 403 });
    const admin = actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO);
    admin.role.isActive = true;
    await expect(provider.history('request-a', admin)).rejects.toMatchObject({ status: 403 });
    expect(repository.history).not.toHaveBeenCalled();
  });

  it('denies an inactive actor even with a persisted relationship', async () => {
    const { provider, repository } = subject();
    const inactive = actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO);
    inactive.isActive = false;
    await expect(provider.history('request-a', inactive)).rejects.toMatchObject({ status: 403 });
    expect(repository.history).not.toHaveBeenCalled();
  });

  it('persists a scoped information request without appending a workflow transition', async () => {
    const { provider, repository } = subject();

    await expect(
      provider.request(
        'request-a',
        { targetActorId: 'target-a', message: 'Please clarify the load plan.' },
        actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO),
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'info-a',
        parentInfoRequestId: null,
        requester: { actorId: 'actor-a', type: 'INTERNAL_MEMBER' },
        target: { actorId: 'target-a', type: 'INTERNAL_MEMBER' },
        status: 'OPEN',
        stateAtRequest: State.MEMBER_ASSIGNED,
        attachments: [],
        responses: [],
      }),
    );

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        stateAtRequest: State.MEMBER_ASSIGNED,
        requestedByActorId: 'actor-a',
        targetActorId: 'target-a',
      }),
    );
    expect(repository.respond).not.toHaveBeenCalled();
  });

  it('uses the existing information-request lifecycle for a route Work Request', async () => {
    const { provider, repository } = subject();
    repository.isRouteWorkRequest.mockResolvedValue({ id: 'route-a' });
    await expect(
      provider.request(
        'request-a',
        { targetActorId: 'target-a', message: 'Please clarify the route handoff.' },
        actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO),
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'info-a', status: 'OPEN' }));
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it('allows the active responsible originating Lead to request route information before Division assignment', async () => {
    const routeSnapshot = prepared();
    routeSnapshot.request.assignments = [];
    routeSnapshot.request.route = {
      responsibleOriginatingLead: {
        memberId: 'member-a',
        revokedAt: null,
        member: { isActive: true },
        division: { isActive: true },
      },
    };
    const { provider, repository } = subject(routeSnapshot);

    await expect(
      provider.eligibleRecipients(
        'request-a',
        actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO),
      ),
    ).resolves.toEqual([
      {
        actorId: 'target-a',
        actorProfileId: 'target-a',
        label: 'Target Lead',
        recipientType: 'INTERNAL_MEMBER',
        contextType: 'DIVISION_LEAD',
        canReceive: true,
        unavailableReason: null,
        displayName: 'Target Lead',
        memberId: 'member-target', email: null, divisionId: null, divisionName: null,
        designationId: null, designationName: null, teamIds: [], teamNames: [], relationshipContexts: [],
        canRespond: true,
        context: { kind: 'DIVISION_LEAD' },
        contexts: [],
        type: 'INTERNAL_MEMBER',
      },
    ]);
    expect(repository.eligibleRecipients).toHaveBeenCalledWith(
      'request-a',
      'actor-a',
    );
  });

  it('requires the request-information grant before persistence', async () => {
    const { provider, repository } = subject();

    await expect(
      provider.request(
        'request-a',
        { targetActorId: 'target-a', message: 'Clarify.' },
        actor(WorkflowActionCode.VIEW_WORK_REQUEST),
      ),
    ).rejects.toThrow("You don't have permission");
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('does not derive clarification authority from a Team or Division title alone', async () => {
    const hierarchyOnly = prepared();
    hierarchyOnly.request.assignments = [
      {
        level: 'TEAM',
        teamId: 'team-a',
        team: { isActive: true, leadMemberId: 'member-a' },
      },
    ];
    const { provider, repository } = subject(hierarchyOnly);
    await expect(
      provider.request(
        'request-a',
        { targetActorId: 'target-a', message: 'Clarify.' },
        actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO, 'team'),
      ),
    ).rejects.toThrow();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('appends a response only for the exact targeted actor and preserves the request', async () => {
    const { provider, repository } = subject();

    await expect(
      provider.respond(
        'request-a',
        'info-a',
        { message: 'The plan is attached to the bid.' },
        actor(WorkflowActionCode.RESPOND_WORKFLOW_INFO),
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'response-a',
        responder: { actorId: 'actor-a', type: 'INTERNAL_MEMBER' },
        attachments: [],
      }),
    );

    expect(repository.respond).toHaveBeenCalledWith(
      'request-a',
      'info-a',
      'actor-a',
      'The plan is attached to the bid.',
      undefined,
      undefined,
      undefined,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', 'cross-tenant or missing information request'],
    ['forbidden', 'a response actor who is not the request target'],
    ['closed', 'a duplicate response after closure'],
  ] as const)('rejects %s response result for %s', async (kind) => {
    const { provider, repository } = subject();
    repository.respond.mockResolvedValue({ kind });

    await expect(
      provider.respond(
        'request-a',
        'info-a',
        { message: 'Response.' },
        actor(WorkflowActionCode.RESPOND_WORKFLOW_INFO),
      ),
    ).rejects.toThrow();
  });

  it('keeps the main state unchanged across reassignment during an open clarification', async () => {
    const { provider, repository } = subject();
    await provider.request(
      'request-a',
      { targetActorId: 'target-a', message: 'Clarify.' },
      actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO),
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ stateAtRequest: State.MEMBER_ASSIGNED }),
    );
    await provider.respond(
      'request-a',
      'info-a',
      { message: 'Done.' },
      actor(WorkflowActionCode.RESPOND_WORKFLOW_INFO),
    );
    expect(repository.prepare).toHaveBeenCalled();
  });

  it('returns tenant-scoped information history without changing workflow state', async () => {
    const { provider, repository } = subject();

    await expect(
      provider.history(
        'request-a',
        actor(WorkflowActionCode.VIEW_WORK_REQUEST),
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'info-a',
        requester: { actorId: 'actor-a', type: 'INTERNAL_MEMBER' },
        target: { actorId: 'target-a', type: 'INTERNAL_MEMBER' },
        attachments: [],
        responses: [],
      }),
    ]);
    expect(repository.history).toHaveBeenCalledWith('request-a', 'actor-a');
  });

  it('returns only backend-derived eligible information recipients', async () => {
    const { provider, repository } = subject();

    await expect(
      provider.eligibleRecipients(
        'request-a',
        actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO),
      ),
    ).resolves.toEqual([
      {
        actorId: 'target-a',
        actorProfileId: 'target-a',
        label: 'Target Lead',
        recipientType: 'INTERNAL_MEMBER',
        contextType: 'DIVISION_LEAD',
        canReceive: true,
        unavailableReason: null,
        displayName: 'Target Lead',
        memberId: 'member-target', email: null, divisionId: null, divisionName: null,
        designationId: null, designationName: null, teamIds: [], teamNames: [], relationshipContexts: [],
        canRespond: true,
        context: { kind: 'DIVISION_LEAD' },
        contexts: [],
        type: 'INTERNAL_MEMBER',
      },
    ]);
    expect(repository.eligibleRecipients).toHaveBeenCalledWith(
      'request-a',
      'actor-a',
    );
  });

  it('rejects a target absent from the backend-derived recipient set', async () => {
    const { provider, repository } = subject();
    repository.eligibleRecipients.mockResolvedValue([]);

    await expect(
      provider.request(
        'request-a',
        { targetActorId: 'target-a', message: 'Clarify.' },
        actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO),
      ),
    ).rejects.toThrow('not eligible');
    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each([
    'Origin Lead -> Client',
    'Origin Lead -> Division Lead',
    'Division Lead -> own Division Team Lead',
    'Division Lead -> other Division Lead',
    'Team Lead -> own Division Lead',
    'Team Lead -> own Team Member',
    'Team Lead -> same-Division Team Lead',
    'Member -> own Team Lead',
    'Member -> own Team Member',
    'persisted reciprocal counterpart',
  ])('accepts a %s target only when the authoritative policy returns it', async () => {
    const { provider, repository } = subject();
    repository.eligibleRecipients.mockResolvedValue([{ id: 'target-a' }]);
    await expect(provider.request('request-a', { targetActorId: 'target-a', message: 'Clarify.' }, actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO))).resolves.toEqual(expect.objectContaining({ id: 'info-a' }));
  });

  it.each([
    'Origin Lead -> Team Lead',
    'Origin Lead -> Member',
    'Division Lead -> Client',
    'Division Lead -> other Division Team Lead',
    'Division Lead -> Member',
    'Team Lead -> Client',
    'Team Lead -> other Division Lead',
    'Team Lead -> Member outside Team',
    'Member -> Division Lead',
    'Member -> Client',
    'Member -> other Team Lead',
    'Member -> Member outside Team',
    'unrelated reciprocal recipient',
  ])('rejects a prohibited %s target absent from the authoritative policy', async () => {
    const { provider, repository } = subject();
    repository.eligibleRecipients.mockResolvedValue([]);
    await expect(provider.request('request-a', { targetActorId: 'target-a', message: 'Clarify.' }, actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO))).rejects.toMatchObject({ status: 403 });
    expect(repository.create).not.toHaveBeenCalled();
  });
});
