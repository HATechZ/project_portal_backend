import { Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { PaginatedResult } from '../common/pagination/paginated-result';
import { CreateUserDto, UpdateUserDto } from './dtos';
import { UserMutationProvider, UserQueryProvider } from './providers';
import { PublicUser } from './repositories';

@Injectable()
export class UserService {
  constructor(
    private readonly mutationProvider: UserMutationProvider,
    private readonly queryProvider: UserQueryProvider,
  ) {}

  create(input: CreateUserDto): Promise<PublicUser> {
    return this.mutationProvider.create(input);
  }

  findAll(query: PaginationQueryDto): Promise<PaginatedResult<PublicUser>> {
    return this.queryProvider.findAll(query);
  }

  findOne(id: string): Promise<PublicUser> {
    return this.queryProvider.findOne(id);
  }

  update(id: string, input: UpdateUserDto): Promise<PublicUser> {
    return this.mutationProvider.update(id, input);
  }

  remove(id: string): Promise<void> {
    return this.mutationProvider.remove(id);
  }
}
