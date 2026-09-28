import {
  demoCompany,
  demoDesignation,
  demoDivision,
  engineeringDocumentCodes,
  etcDocumentCodes,
  generalDocumentCodes,
  marketingDocumentCodes,
  pmOperationDocumentCodes,
  optionTypes,
  optionValues,
} from '../data/demo.data';
import { initializeDefaultClients } from '../default-clients';
import { Seeder } from '../types';

export const demoFixtureSeeder: Seeder = {
  name: 'demo company, client, and reference data',
  async run({ prisma }) {
    await prisma.company.upsert({
      where: { id: demoCompany.id },
      create: demoCompany,
      update: { name: demoCompany.name, abbr: demoCompany.abbr, workspaceSlug: demoCompany.workspaceSlug, companyTypeId: demoCompany.companyTypeId, isActive: true },
    });
    await prisma.division.upsert({
      where: { id: demoDivision.id },
      create: demoDivision,
      update: { name: demoDivision.name, abbr: demoDivision.abbr, isActive: true },
    });
    await prisma.designation.upsert({
      where: { id: demoDesignation.id },
      create: demoDesignation,
      update: { name: demoDesignation.name },
    });
    for (const item of optionTypes) {
      await prisma.optionType.upsert({
        where: { code: item.code },
        create: item,
        update: { name: item.name, isActive: true },
      });
    }
    for (const item of optionValues) {
      const { optionType: optionTypeCode, ...optionValue } = item;
      const optionType = await prisma.optionType.findUniqueOrThrow({ where: { code: optionTypeCode } });
      await prisma.optionValue.upsert({
        where: { id: optionValue.id },
        create: { ...optionValue, tenantId: demoCompany.tenantId, optionTypeId: optionType.id },
        update: { name: optionValue.name, code: optionValue.code, optionTypeId: optionType.id, isActive: true },
      });
    }
    for (const item of [...generalDocumentCodes, ...marketingDocumentCodes, ...etcDocumentCodes, ...engineeringDocumentCodes, ...pmOperationDocumentCodes]) {
      await prisma.documentCodeOption.upsert({
        where: { tenantId_documentGroup_code: { tenantId: item.tenantId, documentGroup: item.documentGroup, code: item.code } },
        create: item,
        update: { name: item.name, sortOrder: item.sortOrder, isActive: true },
      });
    }
    const companies = await prisma.company.findMany({
      select: { id: true, tenantId: true },
    });
    for (const company of companies) {
      await initializeDefaultClients(prisma, company);
    }
  },
};
