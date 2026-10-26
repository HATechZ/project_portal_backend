import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ActiveActor } from '../common/security/active-actor.decorator';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { FinalPermissions } from '../common/security/final-permissions.decorator';
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
import type { SessionActor } from '../common/security/session.types';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { PermissionCode } from '../generated/prisma/client';
import { DocumentManagementService } from './document-management.service';
import {
  SearchDocumentsQueryDto,
  TreeQueryDto,
} from './dtos/document-management-query.dto';

@Controller()
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  FinalPermissionsGuard,
)
export class DocumentManagementController {
  constructor(private readonly service: DocumentManagementService) {}

  @Get('documents/tree')
  @FinalPermissions(PermissionCode.VIEW_DOCUMENT)
  tree(@Query() input: TreeQueryDto, @ActiveActor() actor: SessionActor) {
    return this.service.tree(input, actor);
  }

  @Get('documents/tree/:nodeId/children')
  @FinalPermissions(PermissionCode.VIEW_DOCUMENT)
  children(
    @Param('nodeId') nodeId: string,
    @Query() input: TreeQueryDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.tree({ ...input, parentNodeId: nodeId }, actor);
  }

  @Get('documents/search')
  @FinalPermissions(PermissionCode.VIEW_DOCUMENT)
  search(
    @Query() input: SearchDocumentsQueryDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.search(input, actor);
  }

  @Get('document-versions/:versionId')
  @FinalPermissions(PermissionCode.VIEW_DOCUMENT)
  exact(
    @Param('versionId', ParseUUIDPipe) id: string,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.exact(id, actor);
  }

  @Get('document-versions/:versionId/preview')
  @FinalPermissions(PermissionCode.VIEW_DOCUMENT)
  async preview(
    @Param('versionId', ParseUUIDPipe) id: string,
    @Res() response: Response,
    @ActiveActor() actor: SessionActor,
  ) {
    const file = await this.service.preview(id, actor);
    response
      .type(file.type)
      .setHeader('Content-Disposition', `inline; filename="${file.name}"`);
    file.body.pipe(response);
  }

  @Get('document-versions/:versionId/download')
  @FinalPermissions(PermissionCode.VIEW_DOCUMENT)
  async download(
    @Param('versionId', ParseUUIDPipe) id: string,
    @Res() response: Response,
    @ActiveActor() actor: SessionActor,
  ) {
    const file = await this.service.download(id, actor);
    response.type(file.type).attachment(file.name);
    file.body.pipe(response);
  }
}
