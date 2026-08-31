import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { AuthResponseDto, AuthTokensDto, UserProfileDto } from './dto/auth-response.dto';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new customer account' })
  @ResponseMessage('Registration successful')
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ResponseMessage('Login successful')
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a valid refresh token for a new token pair' })
  @ResponseMessage('Token refreshed successfully')
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke the current refresh token' })
  @ResponseMessage('Logged out successfully')
  logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: LogoutDto): Promise<void> {
    return this.authService.logout(user.id, dto?.refreshToken);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get the currently authenticated user profile' })
  @ResponseMessage('User profile retrieved successfully')
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserProfileDto> {
    return this.authService.me(user.id);
  }
}
