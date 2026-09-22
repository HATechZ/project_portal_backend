import { HttpStatus, PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import {
  CreateProjectMultipartDto,
  ProjectFileMetadataDto,
} from './project.dto';

function invalid(message: string): AppException {
  return new AppException({
    code: AppErrorCode.BadRequest,
    status: HttpStatus.BAD_REQUEST,
    message,
  });
}
function parse(value: unknown, field: string): unknown {
  if (typeof value !== 'string') throw invalid(`${field} must be JSON.`);
  try {
    return JSON.parse(value);
  } catch {
    throw invalid(`${field} must be valid JSON.`);
  }
}
function validate<T extends object>(type: new () => T, value: unknown): T {
  const dto = plainToInstance(type, value);
  if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length)
    throw invalid('The multipart payload is invalid.');
  return dto;
}
export class CreateProjectMultipartPipe implements PipeTransform<
  unknown,
  CreateProjectMultipartDto
> {
  transform(value: unknown): CreateProjectMultipartDto {
    return validate(CreateProjectMultipartDto, value);
  }
}
export class ProjectFileMetadataPipe implements PipeTransform<
  unknown,
  Record<string, ProjectFileMetadataDto>
> {
  transform(value: unknown): Record<string, ProjectFileMetadataDto> {
    if (value === undefined || value === '') return {};
    const parsed = parse(value, 'fileMetadata');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw invalid('fileMetadata must be an object keyed by upload token.');
    return Object.fromEntries(
      Object.entries(parsed).map(([token, metadata]) => [
        token,
        validate(ProjectFileMetadataDto, metadata),
      ]),
    );
  }
}
