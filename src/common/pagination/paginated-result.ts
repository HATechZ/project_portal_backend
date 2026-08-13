import { ApiProperty } from '@nestjs/swagger';

export class PaginationMeta {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
  @ApiProperty() hasNextPage!: boolean;
  @ApiProperty() hasPreviousPage!: boolean;
}

export class PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;

  constructor(items: T[], total: number, page: number, limit: number) {
    const totalPages = Math.ceil(total / limit);
    this.items = items;
    this.meta = {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}
