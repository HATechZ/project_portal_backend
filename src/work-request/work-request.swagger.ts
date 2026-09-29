import type { ApiBodyOptions } from '@nestjs/swagger';

const multipartProperties = {
  bidId: { type: 'string', format: 'uuid' },
  projectId: { type: 'string', format: 'uuid' },
  title: { type: 'string' },
  priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
  notes: { type: 'string' },
  documentCodeIds: {
    type: 'array',
    description:
      'Optional. When files are supplied, provide one UUID for each file in matching order.',
    items: { type: 'string', format: 'uuid' },
  },
  files: {
    type: 'array',
    description:
      'Optional. When supplied, each file requires a matching documentCodeIds entry.',
    items: { type: 'string', format: 'binary' },
  },
};

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
    properties: multipartProperties,
    oneOf: [
      {
        required: ['bidId'],
      },
      {
        required: ['projectId'],
      },
    ],
  },
};
