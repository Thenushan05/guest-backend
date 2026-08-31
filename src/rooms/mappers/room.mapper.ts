import { Prisma } from '@prisma/client';
import { toNumber } from '../../common/utils/decimal.util';

const roomWithRelations = Prisma.validator<Prisma.RoomDefaultArgs>()({
  include: {
    roomType: true,
    images: { orderBy: { sortOrder: 'asc' } },
    facilities: { include: { facility: true } },
  },
});

export type RoomWithRelations = Prisma.RoomGetPayload<typeof roomWithRelations>;

export interface RoomResponse {
  id: string;
  roomNumber: string;
  name: string;
  description: string | null;
  roomTypeId: string;
  roomType: { id: string; name: string; description: string | null } | null;
  pricePerNight: number;
  maximumGuests: number;
  numberOfBeds: number;
  numberOfBathrooms: number;
  roomSize: number | null;
  status: string;
  isActive: boolean;
  images: { id: string; imageUrl: string; isPrimary: boolean; sortOrder: number }[];
  facilities: { id: string; name: string; icon: string | null }[];
  createdAt: Date;
  updatedAt: Date;
}

export const roomIncludeArgs = roomWithRelations.include;

export function mapRoomToResponse(room: RoomWithRelations): RoomResponse {
  return {
    id: room.id,
    roomNumber: room.roomNumber,
    name: room.name,
    description: room.description,
    roomTypeId: room.roomTypeId,
    roomType: room.roomType
      ? { id: room.roomType.id, name: room.roomType.name, description: room.roomType.description }
      : null,
    pricePerNight: toNumber(room.pricePerNight),
    maximumGuests: room.maximumGuests,
    numberOfBeds: room.numberOfBeds,
    numberOfBathrooms: room.numberOfBathrooms,
    roomSize: room.roomSize,
    status: room.status,
    isActive: room.isActive,
    images: room.images.map((img) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      isPrimary: img.isPrimary,
      sortOrder: img.sortOrder,
    })),
    facilities: room.facilities.map((rf) => ({
      id: rf.facility.id,
      name: rf.facility.name,
      icon: rf.facility.icon,
    })),
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}
