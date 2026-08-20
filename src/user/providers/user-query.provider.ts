import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationQueryDto } from '../../common/pagination/dtos/pagination-query.dto';
import { paginate } from '../../common/pagination/paginate';
import { PaginatedResult } from '../../common/pagination/paginated-result';
import { PublicUser, UserRepository } from '../repositories';

@Injectable()
export class UserQueryProvider {
  constructor(private readonly repository: UserRepository) {}

  findAll(query: PaginationQueryDto): Promise<PaginatedResult<PublicUser>> {
    return paginate(
      query,
      (args) => this.repository.findAll(args),
      () => this.repository.count(),
    );
  }

  async findOne(id: string): Promise<PublicUser> {
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundException(`User with ID ${id} was not found`);
    return user;
  }
}
