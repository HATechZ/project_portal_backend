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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiExtension,
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
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { ActiveActor } from '../common/security/active-actor.decorator';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { ObjectScopeGuard } from '../common/security/object-scope.guard';
import { Permissions } from '../common/security/permissions.decorator';
import { PermissionsGuard } from '../common/security/permissions.guard';
import type { SessionActor } from '../common/security/session.types';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';
import { WorkflowActionCode } from '../generated/prisma/client';
import { DocumentUploadMultipartDto } from '../common/documents/document-upload.dto';
import { DocumentSummaryDto } from '../common/documents/document-summary.dto';
import { DocumentVersionResponseDto } from '../common/documents/document-summary.dto';
import { CreateProjectMultipartPipe } from './dtos/multipart-project.pipe';
import {
  ReclassifyProjectDocumentDto,
  ReclassifiedProjectDocumentResponseDto,
  ProjectResponseDto,
  CreateProjectMultipartDto,
  UpdateProjectDto,
} from './dtos/project.dto';
import { ProjectService, type ProjectUploadedFile } from './project.service';
@ApiTags('projects')
@ApiSecurity('bearer')
@Controller('projects')
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
@ApiStandardNotFoundResponse('Project was not found')
@ApiStandardConflictResponse('Project request conflicts with current data')
export class ProjectController {
  constructor(private readonly service: ProjectService) {}
  @Post()
  @Permissions(WorkflowActionCode.ADD_PROJECT)
  @UseInterceptors(
    FilesInterceptor('files', 20, { limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: `Business fields are sent directly as multipart/form-data fields; this is not a JSON payload field. Files are optional and may be uploaded together. When files are supplied, files[i] maps to documentCodeIds[i]; the same Document Code ID may be repeated for multiple files.\n\nBusiness data example:\n\n\`\`\`json\n{\n  "name": "North Sea Project",\n  "clientId": "<uuid>",\n  "shipmentNumber": "01",\n  "documentCodeIds": [\n    "<code-100-uuid>",\n    "<code-802-uuid>"\n  ]\n}\n\`\`\`\n\nExample mapping: files[0] = project-information.pdf and files[1] = contract.pdf; documentCodeIds[0] maps to files[0], and documentCodeIds[1] maps to files[1].`,
    schema: {
      type: 'object',
      required: [
        'name',
        'clientId',
        'polId',
        'podId',
        'cargoId',
        'vesselId',
        'shipmentNumber',
      ],
      properties: {
        name: { type: 'string' },
        clientId: { type: 'string', format: 'uuid' },
        polId: { type: 'string', format: 'uuid' },
        podId: { type: 'string', format: 'uuid' },
        cargoId: { type: 'string', format: 'uuid' },
        vesselId: { type: 'string', format: 'uuid' },
        shipmentNumber: { type: 'string', maxLength: 10 },
        documentCodeIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
        },
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiOperation({
    summary: 'Create Project',
    description:
      'Submit flat business fields as multipart/form-data. Files are optional; upload multiple files with the files picker and provide one documentCodeIds value per file in the same order. Repeated Document Code IDs are valid.',
  })
  @ApiExtension('x-codeSamples', [
    {
      lang: 'JavaScript',
      label: 'Frontend (FormData)',
      source: `const project = {
  name: 'North Sea Project',
  clientId: '<uuid>',
  shipmentNumber: '01',
  documentCodeIds: ['<code-100-uuid>', '<code-802-uuid>'],
};

// Files are optional. Their indexes must match documentCodeIds.
const files = [projectInformationFile, contractFile];
// files[0] <-> documentCodeIds[0]
// files[1] <-> documentCodeIds[1]
// Multiple files may reuse the same Document Code ID.

const formData = new FormData();
formData.append('name', project.name);
formData.append('clientId', project.clientId);
formData.append('shipmentNumber', project.shipmentNumber);
project.documentCodeIds.forEach((id) =>
  formData.append('documentCodeIds', id),
);
files.forEach((file) => formData.append('files', file));

const response = await fetch('/api/v1/projects', {
  method: 'POST',
  headers: { Authorization: \`Bearer \${accessToken}\` },
  body: formData,
});

// Do not set Content-Type manually: the browser supplies the multipart boundary.
// For a Project without files, omit both documentCodeIds and files.`,
    },
  ])
  @ResponseMessage('Project created successfully')
  @ApiStandardCreatedResponse(ProjectResponseDto, 'Project created')
  create(
    @Body(CreateProjectMultipartPipe) body: CreateProjectMultipartDto,
    @UploadedFiles() files: ProjectUploadedFile[] = [],
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.create(
      body,
      files,
      actor.id,
      body.documentCodeIds ?? [],
    );
  }
  @Post(':id/documents')
  @Permissions(WorkflowActionCode.UPDATE_PROJECT)
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
  @ApiOperation({ summary: 'Upload new Project document(s)' })
  @ApiStandardCreatedResponse(DocumentSummaryDto, 'Project documents created')
  @ResponseMessage('Project documents created successfully')
  createDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DocumentUploadMultipartDto,
    @UploadedFiles() files: ProjectUploadedFile[] = [],
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.createStandaloneDocuments(
      id,
      files,
      body.documentCodeIds,
      actor,
    );
  }
  @Post(':id/documents/:documentId/versions')
  @Permissions(WorkflowActionCode.UPDATE_PROJECT)
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
  @ApiOperation({ summary: 'Append immutable Project document version' })
  @ApiStandardCreatedResponse(
    DocumentVersionResponseDto,
    'Project document version created',
  )
  @ResponseMessage('Project document version created successfully')
  appendDocumentVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @UploadedFile() file: ProjectUploadedFile | undefined,
    @ActiveActor() actor: SessionActor,
  ) {
    if (!file) throw new Error('file is required');
    return this.service.appendDocumentVersion(id, documentId, file, actor);
  }
  @Get(':id/documents')
  @Permissions(WorkflowActionCode.VIEW_PROJECT)
  @ApiOperation({ summary: 'List Project documents' })
  @ApiStandardOkResponse(DocumentSummaryDto, 'Project documents returned')
  @ResponseMessage('Project documents returned successfully')
  documents(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.documents(id, actor);
  }
  @Get(':id/documents/:documentId/versions')
  @Permissions(WorkflowActionCode.VIEW_PROJECT)
  @ApiOperation({ summary: 'List immutable Project document versions' })
  @ApiStandardOkResponse(
    DocumentVersionResponseDto,
    'Project document versions returned',
  )
  @ResponseMessage('Project document versions returned successfully')
  documentVersions(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.documentVersions(id, documentId, actor);
  }
  @Get()
  @Permissions(WorkflowActionCode.VIEW_PROJECT)
  @ApiOperation({ summary: 'Get All Projects' })
  @ResponseMessage('Projects returned successfully')
  @ApiPaginatedResponse(ProjectResponseDto)
  list(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }
  @Get(':id')
  @Permissions(WorkflowActionCode.VIEW_PROJECT)
  @ApiOperation({ summary: 'Get Project by ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Project ID' })
  @ResponseMessage('Project returned successfully')
  @ApiStandardOkResponse(ProjectResponseDto, 'Project returned')
  one(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }
  @Patch(':id')
  @Permissions(WorkflowActionCode.UPDATE_PROJECT)
  @ApiOperation({ summary: 'Update Project' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Project ID' })
  @ResponseMessage('Project updated successfully')
  @ApiStandardOkResponse(ProjectResponseDto, 'Project updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProjectDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.update(id, body, actor.id);
  }
  @Patch(':id/documents/:documentId/document-code')
  @Permissions(WorkflowActionCode.UPDATE_PROJECT)
  @ApiOperation({ summary: 'Reclassify Project Document Code' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Project ID' })
  @ApiParam({
    name: 'documentId',
    format: 'uuid',
    description: 'Project document ID',
  })
  @ResponseMessage('Project document code reclassified successfully')
  @ApiStandardOkResponse(
    ReclassifiedProjectDocumentResponseDto,
    'Project document code reclassified',
  )
  reclassifyDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() body: ReclassifyProjectDocumentDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.reclassifyDocument(id, documentId, body, actor.id);
  }
}
