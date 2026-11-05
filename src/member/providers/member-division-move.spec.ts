import type { MemberRecord } from '../repositories';
import { assertDivisionMove } from './member-division-move';

const member = { id: 'member-1', divisionId: 'division-old' } as MemberRecord;

function dependencies() {
  return {
    repository: {
      findDivision: jest.fn().mockResolvedValue({ id: 'division-next' }),
    },
    relations: {
      hasActiveDivisionLead: jest.fn().mockResolvedValue(false),
      hasCrossDivisionTeamLinks: jest.fn().mockResolvedValue(false),
    },
  };
}

describe('Member Division move', () => {
  it('allows a normal move after validating the target and dependencies', async () => {
    const dependenciesForMove = dependencies();

    await expect(
      assertDivisionMove(
        dependenciesForMove as never,
        member,
        'company-1',
        'division-next',
      ),
    ).resolves.toBeUndefined();
    expect(
      dependenciesForMove.relations.hasActiveDivisionLead,
    ).toHaveBeenCalledWith(member.id, member.divisionId);
    expect(
      dependenciesForMove.relations.hasCrossDivisionTeamLinks,
    ).toHaveBeenCalledWith(member.id, 'division-next');
  });

  it('returns 409 while the Member actively leads the old Division', async () => {
    const dependenciesForMove = dependencies();
    dependenciesForMove.relations.hasActiveDivisionLead.mockResolvedValue(true);

    await expect(
      assertDivisionMove(
        dependenciesForMove as never,
        member,
        'company-1',
        'division-next',
      ),
    ).rejects.toMatchObject({
      status: 409,
      message:
        'Remove or reassign this Division Lead before moving the Member to another Division.',
    });
    expect(
      dependenciesForMove.relations.hasCrossDivisionTeamLinks,
    ).not.toHaveBeenCalled();
  });

  it('keeps a same-Division update idempotent', async () => {
    const dependenciesForMove = dependencies();

    await expect(
      assertDivisionMove(
        dependenciesForMove as never,
        member,
        'company-1',
        member.divisionId,
      ),
    ).resolves.toBeUndefined();
    expect(
      dependenciesForMove.relations.hasActiveDivisionLead,
    ).not.toHaveBeenCalled();
    expect(
      dependenciesForMove.relations.hasCrossDivisionTeamLinks,
    ).not.toHaveBeenCalled();
  });

  it('preserves the Team Lead cross-Division conflict', async () => {
    const dependenciesForMove = dependencies();
    dependenciesForMove.relations.hasCrossDivisionTeamLinks.mockResolvedValue(
      true,
    );

    await expect(
      assertDivisionMove(
        dependenciesForMove as never,
        member,
        'company-1',
        'division-next',
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('preserves the active Team Member cross-Division conflict', async () => {
    const dependenciesForMove = dependencies();
    dependenciesForMove.relations.hasCrossDivisionTeamLinks.mockResolvedValue(
      true,
    );

    await expect(
      assertDivisionMove(
        dependenciesForMove as never,
        member,
        'company-1',
        'division-next',
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
