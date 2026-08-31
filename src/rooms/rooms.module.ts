import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { UploadsModule } from '../uploads/uploads.module';
import { AvailabilityModule } from '../availability/availability.module';

@Module({
  imports: [UploadsModule, AvailabilityModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
