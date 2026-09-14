import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { IsOptional, IsString, Matches } from 'class-validator';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { AlimtalkService, type SendOutcome } from './alimtalk.service';

class TestSendDto {
  /** Override recipient (digits only). Defaults to the first ALIMTALK_RECIPIENTS entry. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{9,12}$/, { message: '전화번호는 하이픈 없이 숫자만 입력하세요.' })
  to?: string;
}

@Controller('alimtalk')
export class AlimtalkController {
  constructor(private readonly alimtalk: AlimtalkService) {}

  @Get('status')
  @AdminOnly()
  status(): ReturnType<AlimtalkService['status']> {
    return this.alimtalk.status();
  }

  /** Sends the review template with dummy values to verify the whole chain. */
  @Post('test')
  @AdminOnly()
  @HttpCode(200)
  test(@Body() dto: TestSendDto): Promise<SendOutcome> {
    return this.alimtalk.sendTest(dto.to);
  }
}
