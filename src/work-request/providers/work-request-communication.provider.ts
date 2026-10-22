import { HttpStatus, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { RequestContext } from '../../common/context/request-context';
import type { SessionActor } from '../../common/security/session.types';
import { workRequestTransitionRequestMetadata } from './work-request-transition.definitions';
import { WorkRequestCommunicationRepository } from '../repositories/work-request-communication.repository';

@Injectable()
export class WorkRequestCommunicationProvider {
  constructor(private readonly communications: WorkRequestCommunicationRepository) {}
  async recipients(id: string, actor: SessionActor) {
    const targets = await this.communications.recipientActorIds(id, actor.id, memberId(actor));
    if (targets === null) throw notFound();
    return targets;
  }
  async send(id: string, recipients: string[], message: string, documents: string[] | undefined, actor: SessionActor) {
    if (recipients.length !== new Set(recipients).size || recipients.includes(actor.id)) throw bad('Recipients must be distinct other active participants.');
    const allowed = await this.recipients(id, actor);
    if (!recipients.every((recipient) => allowed.some((target) => target.id === recipient))) throw forbidden();
    const attachmentIds = documents ?? [];
    if (attachmentIds.length !== new Set(attachmentIds).size || !(await this.communications.hasDocumentVersions(id, attachmentIds))) throw bad('Every attachment must be an exact Work Request document version.');
    const meta = workRequestTransitionRequestMetadata();
    const messages = await this.communications.send(id, actor.id, recipients, message, attachmentIds, meta.idempotencyKey, meta.correlationId);
    if (!messages) throw notFound();
    return messages.map(messageResponse);
  }
  async read(id: string, conversationId: string, actor: SessionActor) {
    const conversation = await this.communications.conversation(id, conversationId, actor.id);
    if (!conversation) throw notFound('Conversation was not found.');
    return { id: conversation.id, messages: conversation.messages.map(messageResponse) };
  }
  async reply(id: string, conversationId: string, message: string, documents: string[] | undefined, actor: SessionActor) {
    const conversation: any = await this.communications.conversation(id, conversationId, actor.id);
    if (!conversation) throw notFound('Conversation was not found.');
    const recipient = conversation.firstParticipantActorId === actor.id ? conversation.secondParticipantActorId : conversation.firstParticipantActorId;
    return this.send(id, [recipient], message, documents, actor);
  }
  async mainHistory(id: string, actor: SessionActor) {
    await this.assertRelated(id, actor);
    const history = await this.communications.history(id, actor.id, false);
    if (!history) throw notFound();
    return history;
  }
  async internalHistory(id: string, actor: SessionActor) {
    await this.assertRelated(id, actor);
    const history = await this.communications.history(id, actor.id, true);
    if (!history) throw notFound();
    return history;
  }
  private async assertRelated(id: string, actor: SessionActor) {
    const related = await this.communications.isRelatedActor(id, memberId(actor));
    if (related === null) throw notFound();
    if (!related) throw forbidden();
  }
}
function memberId(actor: SessionActor) { if (!actor.member?.id || !actor.member.isActive) throw forbidden(); return actor.member.id; }
function messageResponse(message: any) { return { id: message.id, conversationId: message.conversationId, sequenceNumber: message.sequenceNumber, senderActorId: message.senderActorId, recipientActorId: message.recipientActorId, message: message.body, sentAt: message.sentAt, attachments: message.attachments.map((attachment: any) => ({ documentVersionId: attachment.documentVersionId })) }; }
function error(code: AppErrorCode, status: HttpStatus, message: string) { return new AppException({ code, status, message }); }
function bad(message: string) { return error(AppErrorCode.BadRequest, HttpStatus.BAD_REQUEST, message); }
function forbidden() { return error(AppErrorCode.Forbidden, HttpStatus.FORBIDDEN, "You don't have permission to perform this action."); }
function notFound(message = 'Work Request route was not found.') { return error(AppErrorCode.NotFound, HttpStatus.NOT_FOUND, message); }
