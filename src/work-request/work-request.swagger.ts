import type { ApiBodyOptions } from '@nestjs/swagger';

export const workRequestCreateMultipartBody: ApiBodyOptions = {
  encoding: {
    bidId: { contentType: 'text/plain' },
    projectId: { contentType: 'text/plain' },
    title: { contentType: 'text/plain' },
    priority: { contentType: 'text/plain' },
    notes: { contentType: 'text/plain' },
    documentCodeIds: {
      contentType: 'text/plain',
      style: 'form',
      explode: true,
    },
    files: {
      contentType: 'application/octet-stream',
      style: 'form',
      explode: true,
    },
  },
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
};
