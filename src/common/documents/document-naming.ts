import { basename, extname } from 'node:path';

export type DocumentNamingContext = {
  projectCode: string;
  cargoCode: string;
  vesselCode: string;
  shipmentNumber: string;
  documentCode: string;
  documentName: string;
  revisionCode: string;
  uploadedFileName: string;
};

export type DocumentVersionMetadata = {
  originalFileName: string;
  uploadedFileName: string;
  versionNumber: number;
  revisionCode: string;
};

export function deriveProjectCode(
  projectName: string,
  polName: string,
  podName: string,
): string {
  const initials = [projectName, polName, podName].map(
    (value) => Array.from(value.trim())[0],
  );
  if (initials.some((value) => !value))
    throw new Error('DOCUMENT_NAMING_PROJECT_CODE');
  return initials.join('').toUpperCase();
}

export function formatBidDocumentFileName(
  input: DocumentNamingContext & { biddingNumber: string },
): string {
  return `${input.biddingNumber} ${formatDirectProjectDocumentFileName(input)}`;
}

export function formatDirectProjectDocumentFileName(
  input: DocumentNamingContext,
): string {
  const extension = extname(input.uploadedFileName).toLowerCase();
  return `${input.projectCode}-${input.cargoCode}-${input.vesselCode}-${input.shipmentNumber}-${input.documentCode}-${input.revisionCode} ${safeDocumentName(input.documentName)}${extension}`;
}

export function initialDocumentVersionMetadata(input: {
  uploadedFileName: string;
  revisionCode: string;
}): DocumentVersionMetadata {
  const uploadedFileName = safeUploadedFileName(input.uploadedFileName);
  return {
    originalFileName: uploadedFileName,
    uploadedFileName,
    versionNumber: 1,
    revisionCode: input.revisionCode,
  };
}

export function nextDocumentVersionMetadata(input: {
  uploadedFileName: string;
  nextVersionNumber: number;
  revisionCode: string;
}): Pick<
  DocumentVersionMetadata,
  'uploadedFileName' | 'versionNumber' | 'revisionCode'
> {
  if (input.nextVersionNumber < 1) throw new Error('DOCUMENT_NAMING_VERSION');
  return {
    uploadedFileName: safeUploadedFileName(input.uploadedFileName),
    versionNumber: input.nextVersionNumber,
    revisionCode: input.revisionCode,
  };
}

export function nextBidRevisionCode(previous?: string): string {
  if (!previous) return 'A';
  if (!/^[A-Z]+$/.test(previous))
    throw new Error('DOCUMENT_NAMING_BID_REVISION');
  const letters = previous.split('');
  let carry = 1;
  for (let index = letters.length - 1; index >= 0 && carry; index -= 1) {
    const value = letters[index].charCodeAt(0) - 64 + carry;
    letters[index] = String.fromCharCode(((value - 1) % 26) + 65);
    carry = value > 26 ? 1 : 0;
  }
  return `${carry ? 'A' : ''}${letters.join('')}`;
}

export function nextProjectRevisionCode(previous?: string): string {
  if (!previous) return '01';
  if (!/^\d+$/.test(previous))
    throw new Error('DOCUMENT_NAMING_PROJECT_REVISION');
  const next = BigInt(previous) + 1n;
  return next.toString().padStart(Math.max(2, previous.length), '0');
}

function safeUploadedFileName(value: string): string {
  const name = basename(value).normalize('NFC').trim();
  if (!name) throw new Error('DOCUMENT_NAMING_FILE_NAME');
  return name;
}

function safeDocumentName(value: string): string {
  const name = basename(value).normalize('NFC').trim();
  if (!name) throw new Error('DOCUMENT_NAMING_DOCUMENT_NAME');
  return name;
}
