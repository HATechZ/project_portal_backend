import { extname } from 'node:path';

/** Neutral canonical formatter shared by independent Bid-backed document owners. */
export function formatBidDocumentFileName(input: {
  biddingNumber: string;
  projectCode: string;
  cargoCode: string;
  vesselCode: string;
  shipmentNumber: string;
  documentCode: string;
  revisionCode: string;
  originalFileName: string;
}): string {
  const extension = extname(input.originalFileName);
  const base = input.originalFileName.slice(
    0,
    input.originalFileName.length - extension.length,
  );
  return `${input.biddingNumber} ${input.projectCode}-${input.cargoCode}-${input.vesselCode}-${input.shipmentNumber}-${input.documentCode}-${input.revisionCode} ${base}${extension}`;
}
