import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { RequestContext } from '../../common/context/request-context';
import { Prisma } from '../../generated/prisma/client';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { MemberRecord, memberSelect } from './member.records';

export interface ExistingUserMemberOnboardingInput {
  userId: string;
  actorProfileId: string;
  divisionId: string;
  designationId: string;
  phone?: string;
}

@Injectable()
export class MemberExistingUserOnboardingRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  createAndLink(
    input: ExistingUserMemberOnboardingInput,
  ): Promise<MemberRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) => {
        await db.$queryRaw`
          SELECT id FROM users
          WHERE id = ${input.userId}::uuid AND tenant_id = ${tenantId}::uuid
          FOR UPDATE
        `;
        const user = await db.user.findFirst({
          where: { id: input.userId, tenantId, isActive: true },
          select: { id: true, fullName: true, email: true },
        });
        if (!user) throw this.notFound('User was not found');

        const company = await db.company.findFirst({
          where: { tenantId, isActive: true },
          select: { id: true },
        });
        if (!company) throw this.notFound('Active Company was not found');

        const actorProfile = await db.actorProfile.findFirst({
          where: {
            id: input.actorProfileId,
            tenantId,
            userId: input.userId,
            isActive: true,
            clientContactId: null,
            role: {
              isActive: true,
              userRolesByRoleId: {
                some: {
                  tenantId,
                  userId: input.userId,
                  revokedAt: null,
                },
              },
            },
          },
          select: { id: true, memberId: true },
        });
        if (!actorProfile)
          throw this.notFound('Eligible ActorProfile was not found');

        const existing = await db.member.findFirst({
          where: { tenantId, userId: input.userId },
          select: {
            ...memberSelect,
            company: { select: { isActive: true } },
          },
        });
        if (existing) {
          if (
            actorProfile.memberId === existing.id &&
            existing.isActive &&
            existing.company.isActive
          )
            return existing;
          throw this.conflict(
            'This User already has a Member. Use the access-link operation for an unlinked ActorProfile.',
          );
        }
        if (actorProfile.memberId) {
          throw this.conflict(
            'ActorProfile is already linked to a different Member.',
          );
        }

        const division = await db.division.findFirst({
          where: {
            id: input.divisionId,
            tenantId,
            companyId: company.id,
            isActive: true,
          },
          select: { id: true },
        });
        if (!division) throw this.notFound('Active Division was not found');

        const designation = await db.designation.findFirst({
          where: {
            id: input.designationId,
            tenantId,
            companyId: company.id,
          },
          select: { id: true },
        });
        if (!designation) throw this.notFound('Designation was not found');

        if (input.phone !== undefined) {
          await db.user.update({
            where: { id: user.id, tenantId },
            data: { phone: input.phone },
          });
        }
        const member = await db.member.create({
          data: {
            tenantId,
            id: randomUUID(),
            userId: user.id,
            companyId: company.id,
            divisionId: division.id,
            designationId: designation.id,
            name: user.fullName.trim(),
            email: user.email.trim().toLowerCase(),
            isActive: true,
          },
          select: memberSelect,
        });
        await db.actorProfile.update({
          where: { id: actorProfile.id, tenantId },
          data: { memberId: member.id },
        });
        return member;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private notFound(message: string): AppException {
    return new AppException({
      code: AppErrorCode.NotFound,
      status: HttpStatus.NOT_FOUND,
      message,
    });
  }

  private conflict(message: string): AppException {
    return new AppException({
      code: AppErrorCode.Conflict,
      status: HttpStatus.CONFLICT,
      message,
    });
  }
}
