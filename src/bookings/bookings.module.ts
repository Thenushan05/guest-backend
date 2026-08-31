import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { AdminBookingsController } from './admin-bookings.controller';
import { BookingsService } from './bookings.service';
import { AvailabilityModule } from '../availability/availability.module';
import { OffersModule } from '../offers/offers.module';

@Module({
  imports: [AvailabilityModule, OffersModule],
  controllers: [BookingsController, AdminBookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
