import { Prisma } from '@prisma/client';
import { toNumber } from '../../common/utils/decimal.util';
import { formatDateOnly } from '../../common/utils/date.util';

const bookingWithRelations = Prisma.validator<Prisma.BookingDefaultArgs>()({
  include: {
    room: { include: { roomType: true, images: { orderBy: { sortOrder: 'asc' }, take: 1 } } },
    user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
    approvedByUser: { select: { id: true, firstName: true, lastName: true } },
  },
});

export type BookingWithRelations = Prisma.BookingGetPayload<typeof bookingWithRelations>;

export const bookingIncludeArgs = bookingWithRelations.include;

export interface BookingResponse {
  id: string;
  bookingNumber: string;
  userId: string | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    address?: string | null;
  } | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customerEmail?: string | null;
  roomId: string;
  room: {
    id: string;
    roomNumber: string;
    name: string;
    roomType: string | null;
    primaryImage: string | null;
  } | null;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  numberOfAdults: number;
  numberOfChildren: number;
  numberOfNights: number;
  pricePerNight: number;
  isAc: boolean;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  status: string;
  customerNote: string | null;
  adminNote: string | null;
  approvedBy: { id: string; firstName: string; lastName: string } | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function mapBookingToResponse(booking: BookingWithRelations): BookingResponse {
  return {
    id: booking.id,
    bookingNumber: booking.bookingNumber,
    userId: booking.userId ?? null,
    customer: booking.user
      ? {
          id: booking.user.id,
          firstName: booking.customerFirstName || booking.user.firstName,
          lastName: booking.customerLastName || booking.user.lastName,
          email: booking.customerEmail || booking.user.email,
          phone: booking.customerPhone || booking.user.phone,
          address: booking.customerAddress || null,
        }
      : {
          id: 'guest',
          firstName: booking.customerFirstName || 'Guest',
          lastName: booking.customerLastName || '',
          email: booking.customerEmail || null,
          phone: booking.customerPhone || null,
          address: booking.customerAddress || null,
        },
    customerFirstName: booking.customerFirstName,
    customerLastName: booking.customerLastName,
    customerPhone: booking.customerPhone,
    customerAddress: booking.customerAddress,
    customerEmail: booking.customerEmail,
    roomId: booking.roomId,
    room: booking.room
      ? {
          id: booking.room.id,
          roomNumber: booking.room.roomNumber,
          name: booking.room.name,
          roomType: booking.room.roomType?.name ?? null,
          primaryImage: booking.room.images[0]?.imageUrl ?? null,
        }
      : null,
    checkInDate: formatDateOnly(booking.checkInDate),
    checkOutDate: formatDateOnly(booking.checkOutDate),
    numberOfGuests: booking.numberOfGuests,
    numberOfAdults: booking.numberOfAdults,
    numberOfChildren: booking.numberOfChildren,
    numberOfNights: booking.numberOfNights,
    pricePerNight: toNumber(booking.pricePerNight),
    isAc: booking.isAc,
    subtotal: toNumber(booking.subtotal),
    discountAmount: toNumber(booking.discountAmount),
    totalAmount: toNumber(booking.totalAmount),
    status: booking.status,
    customerNote: booking.customerNote,
    adminNote: booking.adminNote,
    approvedBy: booking.approvedByUser
      ? {
          id: booking.approvedByUser.id,
          firstName: booking.approvedByUser.firstName,
          lastName: booking.approvedByUser.lastName,
        }
      : null,
    approvedAt: booking.approvedAt,
    rejectedAt: booking.rejectedAt,
    rejectionReason: booking.rejectionReason,
    cancelledAt: booking.cancelledAt,
    cancellationReason: booking.cancellationReason,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}
