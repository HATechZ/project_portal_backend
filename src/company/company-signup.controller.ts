import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiStandardBadRequestResponse,
  ApiStandardConflictResponse,
  ApiStandardCreatedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { CompanySignupService } from './company-signup.service';
import { CompanySignupDto, CompanySignupResponseDto } from './dtos';

@ApiTags('company')
@Controller('company')
export class CompanySignupController {
  constructor(private readonly service: CompanySignupService) {}

  @Post('signup')
  @ResponseMessage('Company workspace created successfully')
  @ApiOperation({ summary: 'Create a Company Account' })
  @ApiStandardCreatedResponse(CompanySignupResponseDto)
  @ApiStandardBadRequestResponse()
  @ApiStandardConflictResponse()
  signup(@Body() input: CompanySignupDto) {
    return this.service.signup(input);
  }
}
