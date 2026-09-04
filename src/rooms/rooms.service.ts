import { Injectable } from '@nestjs/common';
import { Prisma, RoomStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { QueryRoomsDto } from './dto/query-rooms.dto';
import { ReorderImagesDto } from './dto/reorder-images.dto';
import { mapRoomToResponse, roomIncludeArgs, RoomResponse } from './mappers/room.mapper';
import {
  RoomImageNotFoundException,
  RoomNotFoundException,
  RoomNumberExistsException,
  RoomTypeNotFoundException,
} from '../common/exceptions/domain-exceptions';
import { normalizePagination, buildPaginatedResult } from '../common/utils/pagination.util';
import { PaginatedResult } from '../common/dto/paginated-result';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
  ) {}

  async findAll(query: QueryRoomsDto): Promise<PaginatedResult<RoomResponse>> {
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);

    const where: Prisma.RoomWhereInput = {
      ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.guests ? { maximumGuests: { gte: query.guests } } : {}),
      ...(query.minimumPrice || query.maximumPrice
        ? {
            pricePerNight: {
              ...(query.minimumPrice ? { gte: query.minimumPrice } : {}),
              ...(query.maximumPrice ? { lte: query.maximumPrice } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { roomNumber: { contains: query.search } },
              { description: { contains: query.search } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.RoomOrderByWithRelationInput = query.sortBy
      ? { [query.sortBy]: query.sortOrder }
      : { createdAt: 'desc' };

    // Promise.all, not $transaction: independent reads run concurrently over
    // the pool instead of serialized in one DB transaction/connection - a
    // meaningful win on a remote/high-latency DB where each round-trip costs.
    const [rooms, total] = await Promise.all([
      this.prisma.room.findMany({ where, orderBy, skip, take, include: roomIncludeArgs }),
      this.prisma.room.count({ where }),
    ]);

    return buildPaginatedResult(rooms.map(mapRoomToResponse), page, limit, total);
  }

  async findOne(id: string): Promise<RoomResponse> {
    const room = await this.prisma.room.findUnique({ where: { id }, include: roomIncludeArgs });
    if (!room) throw new RoomNotFoundException();
    return mapRoomToResponse(room);
  }

  async create(dto: CreateRoomDto): Promise<RoomResponse> {
    const roomType = await this.prisma.roomType.findUnique({ where: { id: dto.roomTypeId } });
    if (!roomType) throw new RoomTypeNotFoundException();

    const existingRoomNumber = await this.prisma.room.findUnique({
      where: { roomNumber: dto.roomNumber },
    });
    if (existingRoomNumber) throw new RoomNumberExistsException();

    const { facilityIds, ...roomData } = dto;

    const room = await this.prisma.room.create({
      data: {
        ...roomData,
        facilities: facilityIds?.length
          ? { create: facilityIds.map((facilityId) => ({ facilityId })) }
          : undefined,
      },
      include: roomIncludeArgs,
    });

    return mapRoomToResponse(room);
  }

  async update(id: string, dto: UpdateRoomDto): Promise<RoomResponse> {
    await this.ensureRoomExists(id);

    if (dto.roomTypeId) {
      const roomType = await this.prisma.roomType.findUnique({ where: { id: dto.roomTypeId } });
      if (!roomType) throw new RoomTypeNotFoundException();
    }

    if (dto.roomNumber) {
      const existing = await this.prisma.room.findUnique({ where: { roomNumber: dto.roomNumber } });
      if (existing && existing.id !== id) throw new RoomNumberExistsException();
    }

    const { facilityIds, ...roomData } = dto;

    const room = await this.prisma.$transaction(async (tx) => {
      if (facilityIds) {
        await tx.roomFacility.deleteMany({ where: { roomId: id } });
        if (facilityIds.length) {
          await tx.roomFacility.createMany({
            data: facilityIds.map((facilityId) => ({ roomId: id, facilityId })),
          });
        }
      }

      return tx.room.update({
        where: { id },
        data: roomData,
        include: roomIncludeArgs,
      });
    });

    return mapRoomToResponse(room);
  }

  /**
   * Rooms are never hard-deleted so historical bookings remain valid and
   * queryable. "Delete" deactivates the room and marks it INACTIVE.
   */
  async remove(id: string): Promise<void> {
    await this.ensureRoomExists(id);
    await this.prisma.room.update({
      where: { id },
      data: { isActive: false, status: RoomStatus.INACTIVE },
    });
  }

  async addImages(roomId: string, files: Express.Multer.File[]): Promise<RoomResponse> {
    const room = await this.ensureRoomExists(roomId);
    const uploaded = await this.uploadsService.uploadImages(files, `guest-house/rooms/${roomId}`);

    const existingImageCount = await this.prisma.roomImage.count({ where: { roomId } });
    const hasPrimaryAlready = await this.prisma.roomImage.count({
      where: { roomId, isPrimary: true },
    });

    await this.prisma.roomImage.createMany({
      data: uploaded.map((img, index) => ({
        roomId,
        imageUrl: img.url,
        publicId: img.publicId,
        isPrimary: hasPrimaryAlready === 0 && index === 0,
        sortOrder: existingImageCount + index,
      })),
    });

    return this.findOne(room.id);
  }

  async removeImage(roomId: string, imageId: string): Promise<RoomResponse> {
    await this.ensureRoomExists(roomId);
    const image = await this.prisma.roomImage.findFirst({ where: { id: imageId, roomId } });
    if (!image) throw new RoomImageNotFoundException();

    await this.prisma.roomImage.delete({ where: { id: imageId } });
    if (image.publicId) await this.uploadsService.deleteImage(image.publicId);

    if (image.isPrimary) {
      const nextImage = await this.prisma.roomImage.findFirst({
        where: { roomId },
        orderBy: { sortOrder: 'asc' },
      });
      if (nextImage) {
        await this.prisma.roomImage.update({
          where: { id: nextImage.id },
          data: { isPrimary: true },
        });
      }
    }

    return this.findOne(roomId);
  }

  async setPrimaryImage(roomId: string, imageId: string): Promise<RoomResponse> {
    await this.ensureRoomExists(roomId);
    const image = await this.prisma.roomImage.findFirst({ where: { id: imageId, roomId } });
    if (!image) throw new RoomImageNotFoundException();

    await this.prisma.$transaction([
      this.prisma.roomImage.updateMany({ where: { roomId }, data: { isPrimary: false } }),
      this.prisma.roomImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
    ]);

    return this.findOne(roomId);
  }

  async reorderImages(roomId: string, dto: ReorderImagesDto): Promise<RoomResponse> {
    await this.ensureRoomExists(roomId);

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.roomImage.updateMany({
          where: { id: item.imageId, roomId },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );

    return this.findOne(roomId);
  }

  private async ensureRoomExists(id: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new RoomNotFoundException();
    return room;
  }
}
