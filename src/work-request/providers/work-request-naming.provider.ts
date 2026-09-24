import { HttpStatus, Injectable } from '@nestjs/common';
import { formatBidDocumentFileName } from '../../common/utils/bid-document-file-name';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';

@Injectable()
export class WorkRequestNamingProvider {
  generatedFileName(input: {
    bidNaming: {
      biddingNumber: string;
      projectCode: string;
      cargoCode: string;
      vesselCode: string;
      shipmentNumber: string;
    } | null;
    documentCode: string;
    originalFileName: string;
    revisionCode: string;
  }): string | null {
    if (!input.bidNaming) return null;
    const value = formatBidDocumentFileName({
      ...input.bidNaming,
      documentCode: input.documentCode,
      originalFileName: input.originalFileName,
      revisionCode: input.revisionCode,
    });
    if (value.length > 260)
      throw new AppException({
        code: AppErrorCode.BadRequest,
        status: HttpStatus.BAD_REQUEST,
        message: 'Generated filename is too long.',
      });
    return value;
  }
}
