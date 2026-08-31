import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';

@ApiTags('Admin - Users')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List customers/admins with pagination, search and filters' })
  @ResponseMessage('Users retrieved successfully')
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single user by id' })
  @ResponseMessage('User retrieved successfully')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activate, deactivate or block a user' })
  @ResponseMessage('User status updated successfully')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.usersService.updateStatus(id, dto);
  }
}
