import { WorkflowActionCode } from '../../generated/prisma/client';
import { type CustomRoleScope } from './custom-role-policy';
import { RolePermissionQueryProvider } from './role-permission-query.provider';

const permission = (code: WorkflowActionCode) => ({
  id: code,
  code,
  name: code,
  description: null,
  isUserVisible: true,
  isRevisionAction: false,
  isInfoRequestAction: false,
  isAssignmentAction: false,
  isTerminalAction: false,
});

const scopeCases: {
  scope: CustomRoleScope;
  expected: WorkflowActionCode[];
}[] = [
  {
    scope: 'company',
    expected: [
      WorkflowActionCode.ADD_MEMBER,
      WorkflowActionCode.ADD_TEAM,
      WorkflowActionCode.ASSIGN_MEMBER,
    ],
  },
  {
    scope: 'division',
    expected: [
      WorkflowActionCode.ADD_MEMBER,
      WorkflowActionCode.ADD_TEAM,
      WorkflowActionCode.ASSIGN_MEMBER,
    ],
  },
  {
    scope: 'team',
    expected: [WorkflowActionCode.ADD_MEMBER, WorkflowActionCode.ASSIGN_MEMBER],
  },
];

describe('RolePermissionQueryProvider custom-role permission selector', () => {
  const catalogue = [
    permission(WorkflowActionCode.ADD_COMPANY),
    permission(WorkflowActionCode.ADD_MEMBER),
    permission(WorkflowActionCode.ADD_TEAM),
    permission(WorkflowActionCode.ASSIGN_MEMBER),
  ];
  const repository = {
    findVisiblePermissions: jest.fn().mockResolvedValue(catalogue),
  };
  const provider = new RolePermissionQueryProvider(
    repository as never,
    {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it.each(scopeCases)(
    'returns only $scope-eligible custom-role permissions',
    async ({ scope, expected }) => {
      await expect(
        provider.findPermissions(true, scope),
      ).resolves.toMatchObject(expected.map((code) => ({ code })));
      expect(repository.findVisiblePermissions).toHaveBeenCalledTimes(1);
    },
  );

  it('never returns system-only permissions to custom-role selectors', async () => {
    const result = await provider.findPermissions(true, 'company');
    expect(result.map(({ code }) => code)).not.toContain(
      WorkflowActionCode.ADD_COMPANY,
    );
  });

  it('keeps customRole=false catalogue behavior unchanged', async () => {
    await expect(provider.findPermissions(false, 'team')).resolves.toEqual(
      catalogue,
    );
  });
});
