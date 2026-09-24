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
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { ObjectScopeGuard } from '../common/security/object-scope.guard';
import { PermissionsGuard } from '../common/security/permissions.guard';
import { Permissions } from '../common/security/permissions.decorator';
import { ActiveActor } from '../common/security/active-actor.decorator';
import type { SessionActor } from '../common/security/session.types';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';
import {
  ApiStandardBadRequestResponse,
  ApiStandardConflictResponse,
  ApiStandardCreatedResponse,
  ApiStandardForbiddenResponse,
  ApiStandardNotFoundResponse,
  ApiStandardOkResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { WorkflowActionCode } from '../generated/prisma/client';
import {
  CreateWorkRequestDto,
  UpdateWorkRequestDto,
  WorkRequestResponseDto,
} from './dtos/work-request.dto';
import {
  WorkRequestService,
  type WorkRequestUploadedFile,
} from './work-request.service';
@ApiTags('work requests')
@ApiSecurity('bearer')
@Controller('work-requests')
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
@ApiStandardNotFoundResponse('Work Request was not found')
@ApiStandardConflictResponse('Work Request request conflicts with current data')
export class WorkRequestController {
  constructor(private readonly service: WorkRequestService) {}
  @Post()
  @Permissions(WorkflowActionCode.ADD_WORK_REQUEST)
  @UseInterceptors(
    FilesInterceptor('files', 20, { limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'priority'],
      properties: {
        bidId: {
          type: 'string',
          format: 'uuid',
          description: 'Exactly one of bidId or projectId is required.',
        },
        projectId: {
          type: 'string',
          format: 'uuid',
          description: 'Exactly one of bidId or projectId is required.',
        },
        title: { type: 'string' },
        priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
        notes: { type: 'string' },
        documentCodeIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
        },
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiOperation({
    summary: 'Create Work Request',
    description:
      'Multipart fields are flat. Exactly one parent is required. Each files[i] must have documentCodeIds[i].',
  })
  @ApiStandardCreatedResponse(WorkRequestResponseDto, 'Work Request created')
  @ResponseMessage('Work Request created successfully')
  create(
    @Body() body: CreateWorkRequestDto,
    @UploadedFiles() files: WorkRequestUploadedFile[] = [],
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.create(body, files, actor);
  }
  @Get()
  @Permissions(WorkflowActionCode.VIEW_WORK_REQUEST)
  @ResponseMessage('Work Requests returned successfully')
  @ApiOperation({ summary: 'Get Scoped Work Requests' })
  @ApiPaginatedResponse(WorkRequestResponseDto)
  list(@Query() query: PaginationQueryDto, @ActiveActor() actor: SessionActor) {
    return this.service.list(query, actor);
  }
  @Get(':id')
  @Permissions(WorkflowActionCode.VIEW_WORK_REQUEST)
  @ResponseMessage('Work Request returned successfully')
  @ApiOperation({ summary: 'Get Work Request by Work Request ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Work Request ID' })
  @ApiStandardOkResponse(WorkRequestResponseDto, 'Work Request returned')
  find(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.find(id, actor);
  }
  @Patch(':id')
  @Permissions(WorkflowActionCode.UPDATE_WORK_REQUEST)
  @ApiOperation({ summary: 'Update Work Request by Work Request ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Work Request ID' })
  @ResponseMessage('Work Request updated successfully')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateWorkRequestDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.update(id, body, actor);
  }
}
