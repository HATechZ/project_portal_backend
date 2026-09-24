import { WorkRequestResponseDto } from '../dtos/work-request.dto';
import type { WorkRequestRecord } from '../repositories/work-request.records';
export function toWorkRequestResponse(
  record: WorkRequestRecord,
  availableActions: unknown[] = [],
): WorkRequestResponseDto {
  return {
    id: record.id,
    bidId: record.bidId,
    projectId: record.directProjectId,
    title: record.title,
    priority: record.priority,
    notes: record.notes,
    creator: {
      id: record.createdByActor.id,
      label: record.createdByActor.label,
    },
    currentState: record.events[0]?.resultingState ?? 'CREATED',
    documents: record.documents.map((d) => ({
      id: d.id,
      documentCodeId: d.documentCodeId,
      documentCode: d.documentCodeSnapshot,
      originalFileName: d.originalFileName,
      generatedFileName: d.generatedFileName,
      mimeType: d.mimeType,
      size: Number(d.fileSizeBytes),
    })),
    availableActions,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
