import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiStandardBadRequestResponse,
  ApiStandardConflictResponse,
  ApiStandardCreatedResponse,
  ApiStandardForbiddenResponse,
  ApiStandardNotFoundResponse,
  ApiStandardOkResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { ActiveActor } from '../common/security/active-actor.decorator';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { ObjectScopeGuard } from '../common/security/object-scope.guard';
import { Permissions } from '../common/security/permissions.decorator';
import { PermissionsGuard } from '../common/security/permissions.guard';
import type { SessionActor } from '../common/security/session.types';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';
import { WorkflowActionCode } from '../generated/prisma/client';
import { BidService, type BidUploadedFile } from './bid.service';
import { CreateBidMultipartPipe } from './dtos/multipart-bid.pipe';
import {
  CreateBidMultipartDto,
  BidResponseDto,
  ReclassifiedBidDocumentResponseDto,
  ReclassifyBidDocumentDto,
  UpdateBidDto,
} from './dtos/bid.dto';

@ApiTags('bids')
@ApiSecurity('bearer')
@Controller('bids')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  ObjectScopeGuard,
  PermissionsGuard,
)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse()
@ApiStandardNotFoundResponse('Bid was not found')
@ApiStandardConflictResponse('Bid request conflicts with current data')
export class BidController {
  constructor(private readonly service: BidService) {}

  @Post()
  @Permissions(WorkflowActionCode.ADD_BID)
  @UseInterceptors(
    FilesInterceptor('files', 20, { limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'name',
        'clientId',
        'biddingNumber',
        'polOptionId',
        'podOptionId',
        'cargoCodeOptionId',
        'vesselCodeOptionId',
        'shipmentNumber',
      ],
      properties: {
        name: { type: 'string' },
        clientId: { type: 'string', format: 'uuid' },
        biddingNumber: { type: 'string' },
        polOptionId: { type: 'string', format: 'uuid' },
        podOptionId: { type: 'string', format: 'uuid' },
        cargoCodeOptionId: { type: 'string', format: 'uuid' },
        vesselCodeOptionId: { type: 'string', format: 'uuid' },
        shipmentNumber: { type: 'string' },
        documentCodeOptionIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
        },
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiOperation({ summary: 'Create Bid' })
  @ResponseMessage('Bid created successfully')
  @ApiStandardCreatedResponse(BidResponseDto, 'Bid created')
  create(
    @Body(CreateBidMultipartPipe) payload: CreateBidMultipartDto,
    @UploadedFiles() files: BidUploadedFile[] = [],
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.create(
      {
        name: payload.name,
        clientId: payload.clientId,
        bidInfo: payload,
        documents: (payload.documentCodeOptionIds ?? []).map(
          (documentCodeOptionId, fileIndex) => ({
            documentCodeOptionId,
            fileIndex,
          }),
        ),
      },
      files,
      actor.id,
    );
  }

  @Get()
  @Permissions(WorkflowActionCode.VIEW_BID)
  @ApiOperation({ summary: 'List Bids' })
  @ResponseMessage('Bids returned successfully')
  @ApiPaginatedResponse(BidResponseDto)
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Permissions(WorkflowActionCode.VIEW_BID)
  @ApiOperation({ summary: 'Get Bid' })
  @ResponseMessage('Bid returned successfully')
  @ApiStandardOkResponse(BidResponseDto, 'Bid returned')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions(WorkflowActionCode.UPDATE_BID)
  @ApiOperation({ summary: 'Update Bid' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Bid ID' })
  @ResponseMessage('Bid updated successfully')
  @ApiStandardOkResponse(BidResponseDto, 'Bid updated')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateBidDto) {
    return this.service.update(id, input);
  }

  @Patch(':id/documents/:documentId/document-code')
  @Permissions(WorkflowActionCode.UPDATE_BID)
  @ApiOperation({ summary: 'Reclassify a Bid document code' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Bid ID' })
  @ApiParam({
    name: 'documentId',
    format: 'uuid',
    description: 'Bid document ID',
  })
  @ResponseMessage('Bid document code reclassified successfully')
  @ApiStandardOkResponse(
    ReclassifiedBidDocumentResponseDto,
    'Bid document code reclassified',
  )
  reclassifyDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() input: ReclassifyBidDocumentDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.reclassifyDocument(id, documentId, input, actor.id);
  }
}
