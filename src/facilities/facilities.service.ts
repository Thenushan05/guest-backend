import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFacilityDto } from './dto/create-facility.dto';
import { UpdateFacilityDto } from './dto/update-facility.dto';
import { FacilityNotFoundException } from '../common/exceptions/domain-exceptions';

@Injectable()
export class FacilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.facility.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const facility = await this.prisma.facility.findUnique({ where: { id } });
    if (!facility) throw new FacilityNotFoundException();
    return facility;
  }

  create(dto: CreateFacilityDto) {
    return this.prisma.facility.create({ data: dto });
  }

  async update(id: string, dto: UpdateFacilityDto) {
    await this.findOne(id);
    return this.prisma.facility.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Room-facility links cascade automatically (see schema onDelete: Cascade).
    await this.prisma.facility.delete({ where: { id } });
  }
}
