import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import {
  RoomTypeInUseException,
  RoomTypeNotFoundException,
} from '../common/exceptions/domain-exceptions';

@Injectable()
export class RoomTypesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.roomType.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const roomType = await this.prisma.roomType.findUnique({ where: { id } });
    if (!roomType) throw new RoomTypeNotFoundException();
    return roomType;
  }

  create(dto: CreateRoomTypeDto) {
    return this.prisma.roomType.create({ data: dto });
  }

  async update(id: string, dto: UpdateRoomTypeDto) {
    await this.findOne(id);
    return this.prisma.roomType.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);

    const roomCount = await this.prisma.room.count({ where: { roomTypeId: id } });
    if (roomCount > 0) throw new RoomTypeInUseException();

    await this.prisma.roomType.delete({ where: { id } });
  }
}
