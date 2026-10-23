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
import {
  DocumentManagementService,
  type SearchInput,
} from './document-management.service';

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
  tree(
    @Query('parentNodeId') parentNodeId: string | undefined,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.tree(parentNodeId, actor);
  }

  @Get('documents/tree/:nodeId/children')
  @FinalPermissions(PermissionCode.VIEW_DOCUMENT)
  children(
    @Param('nodeId') nodeId: string,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.tree(nodeId, actor);
  }

  @Get('documents/search')
  @FinalPermissions(PermissionCode.VIEW_DOCUMENT)
  search(@Query() input: SearchInput, @ActiveActor() actor: SessionActor) {
    return this.service.search(
      {
        ...input,
        limit: input.limit ? Number(input.limit) : undefined,
        versionNumber: input.versionNumber
          ? Number(input.versionNumber)
          : undefined,
      },
      actor,
    );
  }

  @Get('document-versions/:id')
  @FinalPermissions(PermissionCode.VIEW_DOCUMENT)
  exact(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.exact(id, actor);
  }

  @Get('document-versions/:id/preview')
  @FinalPermissions(PermissionCode.VIEW_DOCUMENT)
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
    @ActiveActor() actor: SessionActor,
  ) {
    const file = await this.service.preview(id, actor);
    response
      .type(file.type)
      .setHeader('Content-Disposition', `inline; filename="${file.name}"`);
    file.body.pipe(response);
  }

  @Get('document-versions/:id/download')
  @FinalPermissions(PermissionCode.VIEW_DOCUMENT)
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
    @ActiveActor() actor: SessionActor,
  ) {
    const file = await this.service.download(id, actor);
    response.type(file.type).attachment(file.name);
    file.body.pipe(response);
  }
}
