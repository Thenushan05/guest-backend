import { Injectable } from '@nestjs/common';
import { DiscountType, Offer, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { QueryOffersDto } from './dto/query-offers.dto';
import { mapOfferToResponse, OfferResponse } from './mappers/offer.mapper';
import { OfferNotFoundException } from '../common/exceptions/domain-exceptions';
import { normalizePagination, buildPaginatedResult } from '../common/utils/pagination.util';
import { PaginatedResult } from '../common/dto/paginated-result';
import { roundCurrency, toNumber } from '../common/utils/decimal.util';

export interface AppliedOffer {
  offerId: string;
  discountAmount: number;
}

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public listing: only currently active, currently running offers. */
  async findAllPublic(query: QueryOffersDto): Promise<PaginatedResult<OfferResponse>> {
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);
    const now = new Date();

    const where: Prisma.OfferWhereInput = {
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    };

    const [offers, total] = await this.prisma.$transaction([
      this.prisma.offer.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.offer.count({ where }),
    ]);

    return buildPaginatedResult(offers.map(mapOfferToResponse), page, limit, total);
  }

  /** Admin listing: every offer, with optional filters, including inactive/expired ones. */
  async findAllAdmin(query: QueryOffersDto): Promise<PaginatedResult<OfferResponse>> {
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);

    const where: Prisma.OfferWhereInput = {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
      ...(query.roomId ? { roomId: query.roomId } : {}),
      ...(query.search ? { title: { contains: query.search } } : {}),
    };

    const orderBy: Prisma.OfferOrderByWithRelationInput = query.sortBy
      ? { [query.sortBy]: query.sortOrder }
      : { createdAt: 'desc' };

    const [offers, total] = await this.prisma.$transaction([
      this.prisma.offer.findMany({ where, orderBy, skip, take }),
      this.prisma.offer.count({ where }),
    ]);

    return buildPaginatedResult(offers.map(mapOfferToResponse), page, limit, total);
  }

  async findOne(id: string): Promise<OfferResponse> {
    const offer = await this.prisma.offer.findUnique({ where: { id } });
    if (!offer) throw new OfferNotFoundException();
    return mapOfferToResponse(offer);
  }

  create(dto: CreateOfferDto): Promise<OfferResponse> {
    return this.prisma.offer.create({ data: dto }).then(mapOfferToResponse);
  }

  async update(id: string, dto: UpdateOfferDto): Promise<OfferResponse> {
    await this.ensureExists(id);
    const offer = await this.prisma.offer.update({ where: { id }, data: dto });
    return mapOfferToResponse(offer);
  }

  async remove(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.offer.delete({ where: { id } });
  }

  /**
   * Determines the best applicable offer for a booking. The frontend never
   * supplies discount data - it is always computed here from live, trusted
   * offer records. When multiple offers qualify, the one yielding the
   * largest discount is applied.
   */
  async findBestApplicableOffer(params: {
    roomId: string;
    roomTypeId: string;
    checkInDate: Date;
    numberOfNights: number;
    subtotal: number;
  }): Promise<AppliedOffer | null> {
    const { roomId, roomTypeId, checkInDate, numberOfNights, subtotal } = params;

    const candidates = await this.prisma.offer.findMany({
      where: {
        isActive: true,
        startDate: { lte: checkInDate },
        endDate: { gte: checkInDate },
        minimumNights: { lte: numberOfNights },
        OR: [{ roomId }, { roomTypeId }, { AND: [{ roomId: null }, { roomTypeId: null }] }],
      },
    });

    if (candidates.length === 0) return null;

    let best: AppliedOffer | null = null;
    for (const offer of candidates) {
      const discountAmount = this.calculateDiscount(offer, subtotal);
      if (!best || discountAmount > best.discountAmount) {
        best = { offerId: offer.id, discountAmount };
      }
    }

    return best;
  }

  calculateDiscount(offer: Offer, subtotal: number): number {
    const value = toNumber(offer.discountValue);
    const rawDiscount =
      offer.discountType === DiscountType.PERCENTAGE ? (subtotal * value) / 100 : value;

    // Never let a discount exceed the subtotal (total cannot go negative).
    return roundCurrency(Math.min(rawDiscount, subtotal));
  }

  private async ensureExists(id: string) {
    const offer = await this.prisma.offer.findUnique({ where: { id } });
    if (!offer) throw new OfferNotFoundException();
    return offer;
  }
}
