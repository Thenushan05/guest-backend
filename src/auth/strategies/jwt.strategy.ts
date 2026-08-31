import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret'),
    });
  }

  /**
   * Whatever is returned here becomes `request.user`. Only the minimal,
   * non-sensitive claims from the verified token are exposed downstream -
   * never the password hash or any raw DB row.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
