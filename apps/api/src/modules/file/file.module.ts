import { Module } from '@nestjs/common';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { WatermarkService } from './watermark.service';
import { DiskSpaceService } from './disk-space.service';

@Module({
  controllers: [FileController],
  providers: [FileService, WatermarkService, DiskSpaceService],
  exports: [FileService, WatermarkService, DiskSpaceService],
})
export class FileModule {}
