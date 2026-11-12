import { RequestContext } from '../../common/context/request-context';
import { WorkRequestExecutionRepository } from './work-request-execution.repository';

describe('WorkRequestExecutionRepository Phase 4 execution guards', () => {
  const context = <T>(work: () => Promise<T>) =>
    RequestContext.run(
      { requestId: 'execution-test', tenantId: 'tenant-a' },
      work,
    );

  function repository(db: Record<string, unknown>) {
    return new WorkRequestExecutionRepository({
      execute: (work: (executor: never) => Promise<unknown>) =>
        work(db as never),
    } as never);
  }

  it("discovers a Division Lead's completed own cycle without querying another Division cycle", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'cycle-marketing',
        completedAt: new Date(),
        routeStep: {
          divisionId: 'division-marketing',
          division: { id: 'division-marketing', name: 'Marketing' },
        },
        teamSteps: [],
      },
    ]);

    await expect(
      context(() =>
        repository({
          workRequestDivisionCycle: { findMany },
        }).internalCycles('request-a', 'marketing-member'),
      ),
    ).resolves.toHaveLength(1);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-a',
          route: { is: { workRequestId: 'request-a' } },
          OR: expect.arrayContaining([
            {
              routeStep: {
                is: {
                  division: {
                    is: {
                      divisionLeadsByDivisionId: {
                        some: {
                          tenantId: 'tenant-a',
                          memberId: 'marketing-member',
                          revokedAt: null,
                        },
                      },
                    },
                  },
                },
              },
            },
          ]),
        }),
        orderBy: [{ routeStep: { ordinal: 'asc' } }, { id: 'asc' }],
      }),
    );
  });

  it("discovers a current Division Lead's own current cycle", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'cycle-pm',
        completedAt: null,
        routeStep: {
          divisionId: 'division-pm',
          division: { id: 'division-pm', name: 'Project Management' },
        },
        teamSteps: [],
      },
    ]);

    await expect(
      context(() =>
        repository({
          workRequestDivisionCycle: { findMany },
        }).internalCycles('request-a', 'pm-member'),
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'cycle-pm',
        routeStep: expect.objectContaining({ divisionId: 'division-pm' }),
      }),
    ]);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              routeStep: expect.objectContaining({
                is: expect.objectContaining({
                  division: expect.objectContaining({
                    is: expect.objectContaining({
                      divisionLeadsByDivisionId: expect.objectContaining({
                        some: expect.objectContaining({
                          memberId: 'pm-member',
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          ]),
        }),
      }),
    );
  });

  it.each([
    ['Team Lead', 'team-lead'],
    ['participating Member', 'member-a'],
  ])(
    'discovers only own-Division cycles for a %s',
    async (_label, memberId) => {
      const findMany = jest.fn().mockResolvedValue([]);

      await expect(
        context(() =>
          repository({ workRequestDivisionCycle: { findMany } }).internalCycles(
            'request-a',
            memberId,
          ),
        ),
      ).resolves.toEqual([]);

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-a',
            OR: expect.arrayContaining([
              {
                teamSteps: {
                  some: { team: { is: { leadMemberId: memberId } } },
                },
              },
              {
                teamSteps: {
                  some: {
                    memberSteps: {
                      some: { memberId, cancelledAt: null },
                    },
                  },
                },
              },
            ]),
          }),
        }),
      );
    },
  );

  it('returns all same-tenant cycles in stable route order only for authorized tenant administration', async () => {
    const findMany = jest.fn().mockResolvedValue([]);

    await expect(
      context(() =>
        repository({ workRequestDivisionCycle: { findMany } }).internalCycles(
          'request-a',
          null,
          true,
        ),
      ),
    ).resolves.toEqual([]);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-a',
          route: { is: { workRequestId: 'request-a' } },
        },
        orderBy: [{ routeStep: { ordinal: 'asc' } }, { id: 'asc' }],
      }),
    );
  });

  it('does not discover a cross-tenant cycle because collection lookup is tenant-scoped', async () => {
    const findMany = jest.fn().mockResolvedValue([]);

    await expect(
      context(() =>
        repository({ workRequestDivisionCycle: { findMany } }).internalCycles(
          'foreign-request',
          null,
          true,
        ),
      ),
    ).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-a' }),
      }),
    );
  });

  it.each([
    ['a Team Lead', 'team-lead'],
    ['a participating Member', 'member-a'],
  ])(
    'returns the authorized Division cycle to %s',
    async (_label, memberId) => {
      const db = {
        workRequestDivisionCycle: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'cycle-a',
            completedAt: null,
            routeStep: {
              divisionId: 'division-a',
              division: { id: 'division-a', name: 'Division A' },
            },
            teamSteps: [
              {
                id: 'team-step-a',
                activatedAt: new Date(),
                completedAt: null,
                team: {
                  id: 'team-a',
                  name: 'Team A',
                  leadMemberId: 'team-lead',
                },
                memberSteps: [{ memberId: 'member-a' }],
              },
            ],
          }),
        },
        divisionLead: { findFirst: jest.fn().mockResolvedValue(null) },
      };

      await expect(
        context(() =>
          repository(db).internalCycle('request-a', 'cycle-a', memberId),
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          id: 'cycle-a',
          workflowVisibility: {
            canViewMainWorkflow: false,
            canViewInternalWorkflow: true,
          },
        }),
      );
    },
  );

  it('describes Division-level Main and Internal Workflow visibility without role-name checks', async () => {
    const db = {
      workRequestDivisionCycle: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cycle-a',
          completedAt: null,
          routeStep: {
            divisionId: 'division-a',
            division: { id: 'division-a', name: 'Division A' },
          },
          teamSteps: [],
        }),
      },
      divisionLead: {
        findFirst: jest.fn().mockResolvedValue({ id: 'lead-a' }),
      },
    };

    await expect(
      context(() =>
        repository(db).internalCycle('request-a', 'cycle-a', 'division-member'),
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        workflowVisibility: {
          canViewMainWorkflow: true,
          canViewInternalWorkflow: true,
        },
      }),
    );
  });

  it.each(['unrelated-member', null])(
    'denies an unrelated actor (%s) from reading an Internal Workflow cycle',
    async (memberId) => {
      const db = {
        workRequestDivisionCycle: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'cycle-a',
            completedAt: null,
            routeStep: {
              divisionId: 'division-a',
              division: { id: 'division-a', name: 'Division A' },
            },
            teamSteps: [
              {
                id: 'team-step-a',
                activatedAt: new Date(),
                completedAt: null,
                team: {
                  id: 'team-a',
                  name: 'Team A',
                  leadMemberId: 'team-lead',
                },
                memberSteps: [{ memberId: 'member-a' }],
              },
            ],
          }),
        },
        divisionLead: { findFirst: jest.fn().mockResolvedValue(null) },
      };

      await expect(
        context(() =>
          repository(db).internalCycle('request-a', 'cycle-a', memberId),
        ),
      ).rejects.toMatchObject({ status: 403 });
    },
  );

  it('describes an already-authorized same-tenant administrator as a high-level workflow view', async () => {
    const db = {
      workRequestDivisionCycle: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cycle-a',
          completedAt: null,
          routeStep: {
            divisionId: 'division-a',
            division: { id: 'division-a', name: 'Division A' },
          },
          teamSteps: [],
        }),
      },
    };

    await expect(
      context(() =>
        repository(db).internalCycle('request-a', 'cycle-a', null, true),
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        workflowVisibility: {
          canViewMainWorkflow: true,
          canViewInternalWorkflow: true,
        },
      }),
    );
  });

  it('does not expose a cross-tenant cycle because the tenant-scoped read does not find it', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    await expect(
      context(() =>
        repository({ workRequestDivisionCycle: { findFirst } }).internalCycle(
          'request-a',
          'cycle-a',
          'member-a',
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-a' }),
      }),
    );
  });

  it('does not let tenant-wide administration bypass a cross-tenant cycle lookup', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    await expect(
      context(() =>
        repository({ workRequestDivisionCycle: { findFirst } }).internalCycle(
          'foreign-request',
          'foreign-cycle',
          null,
          true,
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-a' }),
      }),
    );
  });

  it('freezes a Team sequence once its first execution step exists', async () => {
    const createMany = jest.fn();
    const db = {
      workRequestDivisionCycle: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cycle-a',
          routeId: 'route-a',
          routeStep: { divisionId: 'division-a' },
          route: { projection: { divisionCycleId: 'cycle-a' } },
        }),
      },
      divisionLead: {
        findFirst: jest.fn().mockResolvedValue({ id: 'lead-a' }),
      },
      workRequestTeamStep: {
        count: jest.fn().mockResolvedValue(1),
        createMany,
      },
    };
    const subject = repository(db);
    await expect(
      context(() =>
        subject.defineTeamSequence(
          'request-a',
          'cycle-a',
          ['team-a'],
          'actor-a',
          'lead-member-a',
        ),
      ),
    ).rejects.toMatchObject({ message: 'The Team sequence is frozen.' });
    expect(createMany).not.toHaveBeenCalled();
  });

  it('requires the exact active Division Lead before defining Team work', async () => {
    const count = jest.fn();
    const db = {
      workRequestDivisionCycle: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cycle-a',
          routeId: 'route-a',
          routeStep: { divisionId: 'division-a' },
          route: { projection: { divisionCycleId: 'cycle-a' } },
        }),
      },
      divisionLead: { findFirst: jest.fn().mockResolvedValue(null) },
      workRequestTeamStep: { count },
    };
    const subject = repository(db);
    await expect(
      context(() =>
        subject.defineTeamSequence(
          'request-a',
          'cycle-a',
          ['team-a'],
          'actor-a',
          'other-member',
        ),
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(count).not.toHaveBeenCalled();
  });

  it('allows a tenant-wide internal administrator to define Team work without a Division Lead link', async () => {
    const createMany = jest.fn();
    const db = {
      workRequestDivisionCycle: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cycle-a',
          routeId: 'route-a',
          routeStep: { divisionId: 'division-a' },
          route: { projection: { divisionCycleId: 'cycle-a' } },
        }),
      },
      workRequestTeamStep: {
        count: jest.fn().mockResolvedValue(0),
        createMany,
      },
      team: { findMany: jest.fn().mockResolvedValue([{ id: 'team-a' }]) },
      workRequestRouteProjection: { update: jest.fn() },
      workRequestRouteEvent: { create: jest.fn() },
    };
    const subject = repository(db);
    jest.spyOn(subject, 'internalCycle').mockResolvedValue({} as never);
    await context(() =>
      subject.defineTeamSequence(
        'request-a',
        'cycle-a',
        ['team-a'],
        'admin-a',
        null,
        true,
      ),
    );
    expect(createMany).toHaveBeenCalled();
  });

  it('serializes Member submission and activates only the immediate next Member', async () => {
    const memberUpdate = jest.fn();
    const projectionUpdate = jest.fn();
    const eventCreate = jest.fn();
    const submissionCreate = jest.fn();
    const db = {
      workRequestMemberStep: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'member-step-a',
            memberId: 'member-a',
            routeId: 'route-a',
            teamStepId: 'team-step-a',
            ordinal: 1,
            activatedAt: new Date(),
            submittedAt: null,
            teamStep: {
              divisionCycleId: 'cycle-a',
              completedAt: null,
              divisionCycle: { completedAt: null },
            },
          })
          .mockResolvedValueOnce({ id: 'member-step-b' }),
        update: memberUpdate,
      },
      workRequestRouteProjection: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ memberStepId: 'member-step-a' }),
        update: projectionUpdate,
      },
      workRequestRouteEvent: { create: eventCreate },
      workRequestMemberStepSubmission: { create: submissionCreate },
    };
    const subject = repository(db);
    jest.spyOn(subject, 'internalCycle').mockResolvedValue({} as never);
    await context(() =>
      subject.submitMemberStep(
        'request-a',
        'member-step-a',
        'actor-a',
        'member-a',
      ),
    );
    expect(memberUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'member-step-a' },
        data: expect.objectContaining({ submittedAt: expect.any(Date) }),
      }),
    );
    expect(memberUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'member-step-b' },
        data: expect.objectContaining({ activatedAt: expect.any(Date) }),
      }),
    );
    expect(db.workRequestMemberStep.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        tenantId: 'tenant-a',
        teamStepId: 'team-step-a',
        ordinal: { gt: 1 },
        cancelledAt: null,
        activatedAt: null,
        submittedAt: null,
      },
      orderBy: { ordinal: 'asc' },
    });
    expect(projectionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ memberStepId: 'member-step-b' }),
      }),
    );
    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'MEMBER_STEP_SUBMITTED' }),
      }),
    );
    expect(submissionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: null,
          documents: { create: [] },
        }),
      }),
    );
  });

  it('rejects a non-target Member before writing a completed-history fact', async () => {
    const update = jest.fn();
    const db = {
      workRequestMemberStep: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'member-step-a',
          memberId: 'target-member',
          activatedAt: new Date(),
          submittedAt: null,
          teamStep: {
            completedAt: null,
            divisionCycle: { completedAt: null },
          },
        }),
        update,
      },
    };
    const subject = repository(db);
    await expect(
      context(() =>
        subject.submitMemberStep(
          'request-a',
          'member-step-a',
          'actor-a',
          'other-member',
        ),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(update).not.toHaveBeenCalled();
  });

  it('persists an optional message and deduplicated existing document versions in first-supplied order', async () => {
    const create = jest.fn();
    const db = {
      workRequestMemberStep: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'member-step-a',
            memberId: 'member-a',
            routeId: 'route-a',
            teamStepId: 'team-step-a',
            ordinal: 1,
            activatedAt: new Date(),
            submittedAt: null,
            teamStep: {
              divisionCycleId: 'cycle-a',
              completedAt: null,
              divisionCycle: { completedAt: null },
            },
          })
          .mockResolvedValueOnce(null),
        update: jest.fn(),
      },
      workRequestRouteProjection: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ memberStepId: 'member-step-a' }),
        update: jest.fn(),
      },
      workRequestV1DocumentVersion: { count: jest.fn().mockResolvedValue(2) },
      workRequestMemberStepSubmission: { create },
      workRequestRouteEvent: { create: jest.fn() },
    };
    const subject = repository(db);
    jest.spyOn(subject, 'internalCycle').mockResolvedValue({} as never);
    await context(() =>
      subject.submitMemberStep(
        'request-a',
        'member-step-a',
        'actor-a',
        'member-a',
        {
          message: 'Completed',
          documentVersionIds: ['version-a', 'version-b', 'version-a'],
        },
      ),
    );
    expect(db.workRequestV1DocumentVersion.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-a',
        id: { in: ['version-a', 'version-b'] },
        document: { workRequestId: 'request-a' },
      },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: 'Completed',
          documents: {
            create: [
              expect.objectContaining({
                documentVersionId: 'version-a',
                position: 0,
              }),
              expect.objectContaining({
                documentVersionId: 'version-b',
                position: 1,
              }),
            ],
          },
        }),
      }),
    );
    // Prisma inherits tenantId and submissionId from the composite parent
    // relation; supplying either in CreateWithoutSubmission is invalid.
    for (const link of create.mock.calls[0][0].data.documents.create) {
      expect(Object.keys(link).sort()).toEqual([
        'documentVersionId',
        'id',
        'position',
      ]);
    }
  });

  it.each(['another Work Request', 'another tenant', 'missing/deleted'])(
    'rejects a %s document version before changing workflow state',
    async () => {
      const update = jest.fn();
      const db = {
        workRequestMemberStep: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'member-step-a',
            memberId: 'member-a',
            routeId: 'route-a',
            teamStepId: 'team-step-a',
            ordinal: 1,
            activatedAt: new Date(),
            submittedAt: null,
            teamStep: {
              divisionCycleId: 'cycle-a',
              completedAt: null,
              divisionCycle: { completedAt: null },
            },
          }),
          update,
        },
        workRequestRouteProjection: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ memberStepId: 'member-step-a' }),
        },
        workRequestV1DocumentVersion: { count: jest.fn().mockResolvedValue(0) },
        workRequestMemberStepSubmission: { create: jest.fn() },
      };
      const subject = repository(db);
      await expect(
        context(() =>
          subject.submitMemberStep(
            'request-a',
            'member-step-a',
            'actor-a',
            'member-a',
            { documentVersionIds: ['foreign-version'] },
          ),
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(update).not.toHaveBeenCalled();
    },
  );

  it('rejects an inactive Member step before creating a submission', async () => {
    const create = jest.fn();
    const db = {
      workRequestMemberStep: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'member-step-a',
          memberId: 'member-a',
          activatedAt: null,
          submittedAt: null,
          teamStep: {
            completedAt: null,
            divisionCycle: { completedAt: null },
          },
        }),
        update: jest.fn(),
      },
      workRequestMemberStepSubmission: { create },
    };
    const subject = repository(db);
    await expect(
      context(() =>
        subject.submitMemberStep(
          'request-a',
          'member-step-a',
          'actor-a',
          'member-a',
        ),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(create).not.toHaveBeenCalled();
  });

  it('leaves no active Member projection after the final Member submits, returning completion responsibility to the Team Lead', async () => {
    const projectionUpdate = jest.fn();
    const db = {
      workRequestMemberStep: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'member-step-a',
            memberId: 'member-a',
            routeId: 'route-a',
            teamStepId: 'team-step-a',
            ordinal: 2,
            activatedAt: new Date(),
            submittedAt: null,
            teamStep: {
              divisionCycleId: 'cycle-a',
              completedAt: null,
              divisionCycle: { completedAt: null },
            },
          })
          .mockResolvedValueOnce(null),
        update: jest.fn(),
      },
      workRequestRouteProjection: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ memberStepId: 'member-step-a' }),
        update: projectionUpdate,
      },
      workRequestMemberStepSubmission: { create: jest.fn() },
      workRequestRouteEvent: { create: jest.fn() },
    };
    const subject = repository(db);
    jest.spyOn(subject, 'internalCycle').mockResolvedValue({} as never);
    await context(() =>
      subject.submitMemberStep(
        'request-a',
        'member-step-a',
        'actor-a',
        'member-a',
      ),
    );
    expect(projectionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ memberStepId: null }),
      }),
    );
    expect(db.workRequestMemberStep.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        tenantId: 'tenant-a',
        teamStepId: 'team-step-a',
        ordinal: { gt: 2 },
        cancelledAt: null,
        activatedAt: null,
        submittedAt: null,
      },
      orderBy: { ordinal: 'asc' },
    });
  });
});
