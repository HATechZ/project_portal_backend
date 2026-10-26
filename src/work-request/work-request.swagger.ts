import type { ApiBodyOptions } from '@nestjs/swagger';

const multipartProperties = {
  bidId: { type: 'string', format: 'uuid' },
  projectId: { type: 'string', format: 'uuid' },
  title: { type: 'string' },
  priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
  notes: { type: 'string' },
  originatingDivisionId: { type: 'string', format: 'uuid' },
  intermediateDivisionIds: {
    type: 'array',
    minItems: 1,
    items: { type: 'string', format: 'uuid' },
  },
  documentCodeIds: {
    type: 'array',
    description:
      'Optional. When files are supplied, provide one UUID for each file in matching order.',
    items: { type: 'string', format: 'uuid' },
  },
  descriptions: {
    type: 'array',
    maxItems: 20,
    description:
      'Optional. When supplied, provide one value for each file in matching order. Blank values are stored as null.',
    items: { type: 'string', maxLength: 10000 },
  },
  shipmentNumbers: {
    type: 'array',
    maxItems: 20,
    description:
      'Optional. When supplied, provide one value for each file in matching order. Blank values are stored as null.',
    items: { type: 'string', maxLength: 10 },
  },
  files: {
    type: 'array',
    maxItems: 20,
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
    originatingDivisionId: { contentType: 'text/plain' },
    intermediateDivisionIds: {
      contentType: 'text/plain',
      style: 'form',
      explode: true,
    },
    documentCodeIds: {
      contentType: 'text/plain',
      style: 'form',
      explode: true,
    },
    descriptions: {
      contentType: 'text/plain',
      style: 'form',
      explode: true,
    },
    shipmentNumbers: {
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
    required: [
      'title',
      'priority',
      'originatingDivisionId',
      'intermediateDivisionIds',
    ],
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
