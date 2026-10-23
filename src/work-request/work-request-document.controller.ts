import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Post,
  Body,
  UploadedFiles,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
  ApiStandardForbiddenResponse,
  ApiStandardArrayResponse,
  ApiStandardCreatedArrayResponse,
  ApiStandardCreatedResponse,
  ApiStandardNotFoundResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { ActiveActor } from '../common/security/active-actor.decorator';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { FinalPermissions } from '../common/security/final-permissions.decorator';
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
import type { SessionActor } from '../common/security/session.types';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { PermissionCode } from '../generated/prisma/client';
import { WorkRequestService } from './work-request.service';
import type { WorkRequestUploadedFile } from './work-request.service';
import { DocumentUploadMultipartDto } from '../common/documents/document-upload.dto';
import { DocumentSummaryDto } from '../common/documents/document-summary.dto';
import { DocumentVersionResponseDto } from '../common/documents/document-summary.dto';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

@ApiTags('work requests')
@ApiSecurity('bearer')
@Controller('work-requests/:id/documents')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  FinalPermissionsGuard,
)
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse()
@ApiStandardNotFoundResponse('Work Request document was not found')
export class WorkRequestDocumentController {
  constructor(private readonly service: WorkRequestService) {}
  @Post()
  @FinalPermissions(PermissionCode.UPLOAD_DOCUMENT)
  @UseInterceptors(
    FilesInterceptor('files', 20, { limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files', 'documentCodeIds'],
      properties: {
        documentCodeIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
        },
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiOperation({ summary: 'Upload new Work Request document(s)' })
  @ApiStandardCreatedArrayResponse(
    DocumentSummaryDto,
    'Work Request documents created',
  )
  @ResponseMessage('Work Request documents created successfully')
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DocumentUploadMultipartDto,
    @UploadedFiles() files: WorkRequestUploadedFile[] = [],
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.createStandaloneDocuments(
      id,
      files,
      body.documentCodeIds,
      actor,
    );
  }
  @Post(':documentId/versions')
  @FinalPermissions(PermissionCode.UPLOAD_DOCUMENT)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Append immutable Work Request document version' })
  @ApiStandardCreatedResponse(
    DocumentVersionResponseDto,
    'Work Request document version created',
  )
  @ResponseMessage('Work Request document version created successfully')
  append(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @UploadedFile() file: WorkRequestUploadedFile | undefined,
    @ActiveActor() actor: SessionActor,
  ) {
    if (!file) throw new Error('file is required');
    return this.service.appendDocumentVersion(id, documentId, file, actor);
  }
  @Get()
  @FinalPermissions(PermissionCode.VIEW_WORK_REQUEST)
  @ApiOperation({ summary: 'Get Documents by Work Request ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Work Request ID' })
  @ApiStandardArrayResponse(
    DocumentSummaryDto,
    'Work Request documents returned',
  )
  @ResponseMessage('Work Request documents returned successfully')
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.documents(id, actor);
  }
  @Get(':documentId/versions')
  @FinalPermissions(PermissionCode.VIEW_WORK_REQUEST)
  @ApiOperation({
    summary: 'Get Document Versions by Work Request ID and Document ID',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Work Request ID' })
  @ApiParam({
    name: 'documentId',
    format: 'uuid',
    description: 'Work Request Document ID',
  })
  @ApiStandardArrayResponse(
    DocumentVersionResponseDto,
    'Work Request document versions returned',
  )
  @ResponseMessage('Work Request document versions returned successfully')
  versions(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.documentVersions(id, documentId, actor);
  }
}
