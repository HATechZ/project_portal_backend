import { ActorRoleCode } from '../../../src/generated/prisma/client';

export const ROLE_IDS: Pick<Record<ActorRoleCode, string>, 'tenant_super_admin'> = {
  tenant_super_admin: '10000000-0000-4000-8000-000000000001',
};

export const roles = [
  {
    systemCode: ActorRoleCode.tenant_super_admin,
    name: 'Tenant Super Administrator',
    description: 'Highest administrator for this tenant/company; access remains permission and scope driven.',
  },
] as const;
