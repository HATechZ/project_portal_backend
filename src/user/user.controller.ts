import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateUserDto, UpdateUserDto } from './dtos';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { SystemAdminGuard } from '../auth/guards/system-admin.guard';
import { UserService } from './user.service';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @UseGuards(AuthenticatedGuard, SystemAdminGuard)
  @ApiOperation({ summary: 'Create a user' })
  @ApiCreatedResponse({ description: 'User created' })
  @ApiConflictResponse({ description: 'Email is already in use' })
  create(@Body() input: CreateUserDto) {
    const { fullName, email, password, avatarUrl } = input;
    return this.userService.create({ fullName, email, password, avatarUrl });
  }

  @Get()
  @ApiOperation({ summary: 'List all users' })
  @ApiOkResponse({ description: 'Users returned' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.userService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'User returned' })
  @ApiNotFoundResponse({ description: 'User was not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'User updated' })
  @ApiNotFoundResponse({ description: 'User was not found' })
  @ApiConflictResponse({ description: 'Email is already in use' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateUserDto) {
    const { fullName, email, password, avatarUrl } = input;
    return this.userService.update(id, {
      fullName,
      email,
      password,
      avatarUrl,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'User deleted' })
  @ApiNotFoundResponse({ description: 'User was not found' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.userService.remove(id);
  }
}
