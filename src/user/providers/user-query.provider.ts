import { HttpStatus, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
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
    if (!user)
      throw new AppException({
        code: AppErrorCode.NotFound,
        status: HttpStatus.NOT_FOUND,
        message: 'User not found. Check the selected user and try again.',
      });
    return user;
  }
}
