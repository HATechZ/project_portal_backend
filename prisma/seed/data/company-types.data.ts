export const EPC_CONTRACTOR_COMPANY_TYPE_ID =
  '20000000-0000-4000-8000-000000000001';

export const companyTypes = [
  {
    id: EPC_CONTRACTOR_COMPANY_TYPE_ID,
    name: 'EPC Contractor',
    description: 'Engineering, procurement, and construction contractor.',
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    name: 'Owner / Developer',
    description: 'Project owner, developer, or sponsoring organization.',
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    name: 'Engineering Consultant',
    description: 'Design, engineering, advisory, or technical consulting firm.',
  },
  {
    id: '20000000-0000-4000-8000-000000000004',
    name: 'Subcontractor',
    description: 'Specialized subcontractor supporting delivery or execution.',
  },
  {
    id: '20000000-0000-4000-8000-000000000005',
    name: 'Supplier / Vendor',
    description: 'Equipment, material, technology, or service supplier.',
  },
  {
    id: '20000000-0000-4000-8000-000000000006',
    name: 'Joint Venture',
    description: 'Joint venture, consortium, or partnership entity.',
  },
] as const;
