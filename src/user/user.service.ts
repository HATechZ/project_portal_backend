import { Injectable } from '@nestjs/common';
import { CreateUserDto, UpdateUserDto } from './dtos';
import { UserCreateProvider } from './providers';
import { PublicUser } from './repositories';

@Injectable()
export class UserService {
  constructor(private readonly userCreateProvider: UserCreateProvider) {}

  create(input: CreateUserDto): Promise<PublicUser> {
    return this.userCreateProvider.create(input);
  }

  findAll(): Promise<PublicUser[]> {
    return this.userCreateProvider.findAll();
  }

  findOne(id: string): Promise<PublicUser> {
    return this.userCreateProvider.findOne(id);
  }

  update(id: string, input: UpdateUserDto): Promise<PublicUser> {
    return this.userCreateProvider.update(id, input);
  }

  remove(id: string): Promise<void> {
    return this.userCreateProvider.remove(id);
  }
}
