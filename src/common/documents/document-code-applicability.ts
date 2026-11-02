import { DocumentGroupCode } from '../../generated/prisma/client';

/**
 * The single applicability policy used by document selectors and server-side
 * upload/create validation. GENERAL is always available; business features
 * add only their approved groups.
 */
export const bidProjectDocumentGroups = () => [
  DocumentGroupCode.GENERAL,
  DocumentGroupCode.MARKETING,
];

export const workRequestDocumentGroups = (
  configuredGroups: DocumentGroupCode[],
) => [
  DocumentGroupCode.GENERAL,
  ...configuredGroups.filter((group) => group !== DocumentGroupCode.GENERAL),
];

export const applicableDocumentCodeWhere = (
  tenantId: string,
  groups: DocumentGroupCode[],
  ids?: string[],
) => ({
  tenantId,
  isActive: true,
  documentGroup: { in: groups },
  ...(ids ? { id: { in: ids } } : {}),
});
