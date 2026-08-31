import { Module } from '@nestjs/common';
import { OffersController } from './offers.controller';
import { AdminOffersController } from './admin-offers.controller';
import { OffersService } from './offers.service';

@Module({
  controllers: [OffersController, AdminOffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
