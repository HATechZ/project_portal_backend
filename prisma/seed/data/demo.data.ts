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

export const generalDocumentCodes = [
  ['000', 'Info'], ['001', 'Project Information'], ['002', 'Cargo Information'],
  ['011', 'Action Log'], ['012', 'Contact List'], ['013', 'Comment Sheet'],
].map(([code, name], index) => ({
  id: `73000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  tenantId: DEFAULT_TENANT_ID,
  documentGroup: DocumentGroupCode.GENERAL,
  code,
  name,
  sortOrder: index + 1,
}));

export const marketingDocumentCodes = ([
  ['801', '수주통보서', 9], ['802', 'Contract', 7], ['803', 'Invoice', 8],
  ] as const).map(([code, name, idNumber], index) => ({
  id: `73000000-0000-4000-8000-${String(idNumber).padStart(12, '0')}`,
  tenantId: DEFAULT_TENANT_ID,
  documentGroup: DocumentGroupCode.MARKETING,
  code,
  name,
  sortOrder: index + 1,
}));

export const etcDocumentCodes = ([
  ['901', 'Lesson and Learnt', 10], ['902', 'Picture', 11], ['999', 'Backup', 12],
] as const).map(([code, name, idNumber], index) => ({
  id: `73000000-0000-4000-8000-${String(idNumber).padStart(12, '0')}`,
  tenantId: DEFAULT_TENANT_ID,
  documentGroup: DocumentGroupCode.ETC,
  code,
  name,
  sortOrder: index + 1,
}));

export const engineeringDocumentCodes = ([
  ['100', 'Stowage Plan', 13],
  ['101', 'Shipment Calculation', 14],
  ['110', 'Intereference Check', 15],
  ['130', 'Berthing Feasibility Check', 16],
  ['200', 'Loading Condition-Voyage Condition', 17],
  ['211', 'Stern Ballast Plan for Loading', 18],
  ['212', 'Stern Ballast Plan for Discharging', 19],
  ['221', 'Side Ballast Plan for Loading', 20],
  ['222', 'Side Ballast Plan for Discharging', 21],
  ['231', 'Ballast Plan for Float On', 22],
  ['232', 'Ballast Plan for Float Off', 23],
  ['250', 'Stability Report (Intact, Damage)', 24],
  ['301', 'Mooring Arrangement Plan at POL', 25],
  ['302', 'Mooring Arrangement Plan at POD', 26],
  ['341', 'Mooring Procedure Plan at POL', 27],
  ['342', 'Mooring Procedure Plan at POD', 28],
  ['351', 'Mooring Analysis Report at POL', 29],
  ['352', 'Mooring Analysis Report at POD', 30],
  ['361', 'Port Entry Plan at POL', 31],
  ['362', 'Port Entry Plan at POD', 32],
  ['371', 'Berthing Procedure Report at POL', 33],
  ['372', 'Berthing Procedure Report at POD', 34],
  ['400', 'Voyage Route Analysis', 35],
  ['410', 'Summary of Motion Analysis Report', 36],
  ['411', 'Speed vs Acceleration', 37],
  ['412', 'Static Applied Wind Pressure Trim Calculation', 38],
  ['420', 'RAO', 39],
  ['430', 'Critical Motion Curve', 40],
  ['440', 'Green Water Analysis', 41],
] as const).map(([code, name, idNumber], index) => ({
  id: `73000000-0000-4000-8000-${String(idNumber).padStart(12, '0')}`,
  tenantId: DEFAULT_TENANT_ID,
  documentGroup: DocumentGroupCode.ENGINEERING,
  code,
  name,
  sortOrder: index + 1,
}));

export const pmOperationDocumentCodes = ([
  ['601', 'Method Statement', 42],
  ['602', 'Voyage & Weather Routing Plan', 43],
  ['603', 'HSEQ Management Plan', 44],
  ['604', 'Safe Working Plan', 45],
  ['605', 'Emergency Response Plan', 46],
  ['606', 'Anti-Piracy Plan', 47],
  ['607', 'Crew Management Plan', 48],
  ['608', 'Vessel Maintenance Plan', 49],
] as const).map(([code, name, idNumber], index) => ({
  id: `73000000-0000-4000-8000-${String(idNumber).padStart(12, '0')}`,
  tenantId: DEFAULT_TENANT_ID,
  documentGroup: DocumentGroupCode.PROJECT_MANAGEMENT_OPERATION,
  code,
  name,
  sortOrder: index + 1,
}));
