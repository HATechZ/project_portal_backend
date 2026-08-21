import { ActorRoleCode } from '../../../src/generated/prisma/client';

export const ROLE_IDS: Record<ActorRoleCode, string> = {
  system_admin: '10000000-0000-4000-8000-000000000001',
  ccr_coordinator: '10000000-0000-4000-8000-000000000003',
  division_lead: '10000000-0000-4000-8000-000000000004',
  division_member: '10000000-0000-4000-8000-000000000005',
  tms_manager: '10000000-0000-4000-8000-000000000006',
  tms_drawing: '10000000-0000-4000-8000-000000000007',
  tms_checking: '10000000-0000-4000-8000-000000000008',
  tms_approval: '10000000-0000-4000-8000-000000000009',
  client_owner: '10000000-0000-4000-8000-000000000010',
};

export const roles = [
  {
    code: ActorRoleCode.system_admin,
    name: 'System Administrator',
    description: 'Full system administration access.',
  },
  {
    code: ActorRoleCode.ccr_coordinator,
    name: 'CCR Coordinator',
    description: 'Coordinates CCR workflow activities.',
  },
  {
    code: ActorRoleCode.division_lead,
    name: 'Division Lead',
    description: 'Leads division workflow activities.',
  },
  {
    code: ActorRoleCode.division_member,
    name: 'Division Member',
    description: 'Performs division workflow activities.',
  },
  {
    code: ActorRoleCode.tms_manager,
    name: 'TMS Manager',
    description: 'Manages the TMS workflow chain.',
  },
  {
    code: ActorRoleCode.tms_drawing,
    name: 'TMS Drawing',
    description: 'Produces TMS drawings.',
  },
  {
    code: ActorRoleCode.tms_checking,
    name: 'TMS Checking',
    description: 'Checks TMS submissions.',
  },
  {
    code: ActorRoleCode.tms_approval,
    name: 'TMS Approval',
    description: 'Approves TMS submissions.',
  },
  {
    code: ActorRoleCode.client_owner,
    name: 'Client Owner',
    description: 'Represents the client in project workflows.',
  },
] as const;
