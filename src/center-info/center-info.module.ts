import { Module } from '@nestjs/common';
import { CenterInfoController } from './center-info.controller';
import { CenterInfoService } from './center-info.service';

@Module({
  controllers: [CenterInfoController],
  providers: [CenterInfoService],
})
export class CenterInfoModule {}
