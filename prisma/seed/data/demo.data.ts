import { DocumentGroupCode, OptionTypeCode } from '../../../src/generated/prisma/client';
import { DEFAULT_TENANT_ID } from './tenants.data';
import { EPC_CONTRACTOR_COMPANY_TYPE_ID } from './company-types.data';

export const demoCompany = {
  id: '70000000-0000-4000-8000-000000000001',
  tenantId: DEFAULT_TENANT_ID,
  name: 'Default Organization',
  abbr: 'DEFAULT',
  workspaceSlug: 'default-organization',
  companyTypeId: EPC_CONTRACTOR_COMPANY_TYPE_ID,
} as const;

export const demoDivision = {
  id: '70000000-0000-4000-8000-000000000002',
  tenantId: DEFAULT_TENANT_ID,
  companyId: demoCompany.id,
  name: 'Commercial',
  abbr: 'COMM',
} as const;

export const demoDesignation = {
  id: '70000000-0000-4000-8000-000000000003',
  tenantId: DEFAULT_TENANT_ID,
  companyId: demoCompany.id,
  name: 'Coordinator',
} as const;

export const demoClient = {
  id: '70000000-0000-4000-8000-000000000004',
  tenantId: DEFAULT_TENANT_ID,
  companyId: demoCompany.id,
  name: 'Demo Client',
} as const;

export const demoClientContact = {
  id: '70000000-0000-4000-8000-000000000005',
  tenantId: DEFAULT_TENANT_ID,
  clientId: demoClient.id,
  name: 'Demo Client Contact',
  email: 'contact@demo-client.local',
  designation: 'Primary Contact',
  isPrimary: true,
} as const;

export const optionTypes = [
  { id: '71000000-0000-4000-8000-000000000001', code: OptionTypeCode.POL, name: 'Port of Loading' },
  { id: '71000000-0000-4000-8000-000000000002', code: OptionTypeCode.POD, name: 'Port of Discharge' },
  { id: '71000000-0000-4000-8000-000000000003', code: OptionTypeCode.CARGO_CODE, name: 'Cargo Code' },
  { id: '71000000-0000-4000-8000-000000000004', code: OptionTypeCode.VESSEL_CODE, name: 'Vessel Code' },
] as const;

export const optionValues = [
  { id: '72000000-0000-4000-8000-000000000001', optionType: OptionTypeCode.POL, name: 'Chittagong', code: 'CTG' },
  { id: '72000000-0000-4000-8000-000000000002', optionType: OptionTypeCode.POD, name: 'Singapore', code: 'SIN' },
  { id: '72000000-0000-4000-8000-000000000003', optionType: OptionTypeCode.CARGO_CODE, name: 'General Cargo', code: 'GEN' },
  { id: '72000000-0000-4000-8000-000000000004', optionType: OptionTypeCode.VESSEL_CODE, name: 'Demo Vessel', code: 'DEMO-VSL' },
] as const;

export const documentCodes = [
  ['000', 'Info'], ['001', 'Project Information'], ['002', 'Cargo Information'],
  ['011', 'Action Log'], ['012', 'Contact List'], ['013', 'Comment Sheet'],
  ['802', 'Contract'], ['803', 'Invoice'],
].map(([code, name], index) => ({
  id: `73000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  tenantId: DEFAULT_TENANT_ID,
  documentGroup: DocumentGroupCode.MARKETING,
  code,
  name,
  sortOrder: index + 1,
}));
