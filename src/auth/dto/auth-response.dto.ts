import { ApiProperty } from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma/client';

export class UserProfileDto {
  @ApiProperty() id: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty() email: string;
  @ApiProperty({ required: false, nullable: true }) phone: string | null;
  @ApiProperty({ enum: Role }) role: Role;
  @ApiProperty({ enum: UserStatus }) status: UserStatus;
  @ApiProperty() createdAt: Date;
}

export class AuthTokensDto {
  @ApiProperty() accessToken: string;
  @ApiProperty() refreshToken: string;
}

export class AuthResponseDto extends AuthTokensDto {
  @ApiProperty({ type: UserProfileDto }) user: UserProfileDto;
}
