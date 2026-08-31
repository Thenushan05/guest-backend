import { Injectable } from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserNotFoundException } from '../common/exceptions/domain-exceptions';
import { UserProfileDto } from '../auth/dto/auth-response.dto';
import { normalizePagination, buildPaginatedResult } from '../common/utils/pagination.util';
import { PaginatedResult } from '../common/dto/paginated-result';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryUsersDto): Promise<PaginatedResult<UserProfileDto>> {
    const { page, limit, skip, take } = normalizePagination(query.page, query.limit);

    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search } },
              { lastName: { contains: query.search } },
              { email: { contains: query.search } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.UserOrderByWithRelationInput = query.sortBy
      ? { [query.sortBy]: query.sortOrder }
      : { createdAt: 'desc' };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, orderBy, skip, take }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResult(
      users.map((u) => this.toProfile(u)),
      page,
      limit,
      total,
    );
  }

  async findOne(id: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UserNotFoundException();
    return this.toProfile(user);
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UserNotFoundException();

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
    });

    return this.toProfile(updated);
  }

  private toProfile(user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    role: Role;
    status: UserStatus;
    createdAt: Date;
  }): UserProfileDto {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}
