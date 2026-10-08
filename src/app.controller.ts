import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { ApiStandardOkResponse } from './common/decorators/api-standard-response.decorator';
import { ResponseMessage } from './common/decorators/response-message.decorator';

@Controller()
@ApiTags('system')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get API availability' })
  @ApiStandardOkResponse(String, 'Project Portal API is available')
  @ResponseMessage('Project Portal API is available')
  getHello(): string {
    return this.appService.getHello();
  }
}
