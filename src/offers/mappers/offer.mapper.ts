import { DayOfWeek, Offer } from '@prisma/client';
import { toNumber } from '../../common/utils/decimal.util';

export interface OfferResponse {
  id: string;
  title: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  startDate: Date;
  endDate: Date;
  daysOfWeek: DayOfWeek[];
  minimumNights: number;
  roomTypeId: string | null;
  roomId: string | null;
  isActive: boolean;
  bannerImage: string | null;
  iconName?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function mapOfferToResponse(offer: Offer): OfferResponse {
  return {
    id: offer.id,
    title: offer.title,
    description: offer.description,
    discountType: offer.discountType,
    discountValue: toNumber(offer.discountValue),
    startDate: offer.startDate,
    endDate: offer.endDate,
    daysOfWeek: offer.daysOfWeek,
    minimumNights: offer.minimumNights,
    roomTypeId: offer.roomTypeId,
    roomId: offer.roomId,
    isActive: offer.isActive,
    bannerImage: offer.bannerImage,
    iconName: (offer as any).iconName ?? null,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
  };
}
