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
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiSecurity,
} from '@nestjs/swagger';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dtos';
import {
  ApiStandardBadRequestResponse,
  ApiStandardCreatedResponse,
  ApiStandardConflictResponse,
  ApiStandardForbiddenResponse,
  ApiStandardNotFoundResponse,
  ApiStandardOkResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { SystemAdminGuard } from '../auth/guards/system-admin.guard';
import { UserService } from './user.service';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';

@ApiTags('users')
@ApiSecurity('tenant')
@Controller('users')
@UseGuards(TenantContextGuard, AuthenticatedGuard, SystemAdminGuard)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse('System administrator access required')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Create a user' })
  @ApiStandardCreatedResponse(UserResponseDto, 'User created')
  @ApiStandardConflictResponse(
    'Email is already in use',
    'A user with this email already exists',
  )
  create(@Body() input: CreateUserDto) {
    return this.userService.create(input);
  }

  @Get()
  @ApiOperation({ summary: 'List all users' })
  @ApiPaginatedResponse(UserResponseDto)
  findAll(@Query() query: PaginationQueryDto) {
    return this.userService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(UserResponseDto, 'User returned')
  @ApiStandardNotFoundResponse(
    'User was not found',
    'User with ID 0c10bb48-f0e4-4884-909d-cf6408914290 was not found',
  )
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(UserResponseDto, 'User updated')
  @ApiStandardNotFoundResponse(
    'User was not found',
    'User with ID 0c10bb48-f0e4-4884-909d-cf6408914290 was not found',
  )
  @ApiStandardConflictResponse(
    'Email is already in use',
    'A user with this email already exists',
  )
  update(@Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateUserDto) {
    return this.userService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'User deleted' })
  @ApiStandardNotFoundResponse(
    'User was not found',
    'User with ID 0c10bb48-f0e4-4884-909d-cf6408914290 was not found',
  )
  @ApiStandardConflictResponse(
    'User is referenced by other records and cannot be deleted',
    'This user is referenced by other records and cannot be deleted',
  )
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.userService.remove(id);
  }
}
