import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';

@ApiTags('Admin - Dashboard')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get high-level operational statistics (admin only)' })
  @ResponseMessage('Dashboard statistics retrieved successfully')
  getStats() {
    return this.dashboardService.getStats();
  }
}
