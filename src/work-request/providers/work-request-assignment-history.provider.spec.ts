import { WorkRequestV1AssignmentLevelCode as Level } from '../../generated/prisma/client';
import { WorkRequestAssignmentHistoryProvider } from './work-request-assignment-history.provider';

describe('WorkRequestAssignmentHistoryProvider', () => {
  it('returns the safe assignment-history projection', async () => {
    const history = jest.fn().mockResolvedValue([
      {
        id: 'assignment-a',
        level: Level.MEMBER,
        divisionId: null,
        teamId: null,
        memberId: 'member-a',
        assignedAt: new Date('2026-11-05T00:00:00.000Z'),
        unassignedAt: null,
        replacedAt: null,
        note: null,
        member: { id: 'member-a', name: 'Safe Member Name' },
        assignedByActor: { id: 'actor-a', label: 'Coordinator' },
        division: null,
      },
    ]);
    const provider = new WorkRequestAssignmentHistoryProvider(
      { execute: (work: () => Promise<unknown>) => work() } as never,
      { find: jest.fn().mockResolvedValue({ id: 'request-a' }) } as never,
      { history } as never,
    );

    await expect(provider.history('request-a', {} as never)).resolves.toEqual([
      expect.objectContaining({
        id: 'assignment-a',
        assignee: { id: 'member-a', label: 'Safe Member Name' },
        assignedBy: { id: 'actor-a', label: 'Coordinator' },
        responsibleRecipients: [],
      }),
    ]);
  });

  it('does not expose inaccessible Work Requests', async () => {
    const history = jest.fn();
    const provider = new WorkRequestAssignmentHistoryProvider(
      { execute: (work: () => Promise<unknown>) => work() } as never,
      { find: jest.fn().mockResolvedValue(null) } as never,
      { history } as never,
    );

    await expect(provider.history('request-a', {} as never)).rejects.toThrow(
      'Work Request was not found.',
    );
    expect(history).not.toHaveBeenCalled();
  });
});
