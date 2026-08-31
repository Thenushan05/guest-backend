import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UnauthorizedDomainException } from '../exceptions/domain.exception';
import { ErrorCode } from '../enums/error-code.enum';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Applied globally (see AppModule). Validates the JWT access token on every
 * route unless the handler or controller is annotated with @Public().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(err: unknown, user: TUser | false): TUser {
    if (err || !user) {
      throw new UnauthorizedDomainException(
        ErrorCode.UNAUTHORIZED,
        'Authentication required. Please log in.',
      );
    }
    return user;
  }
}
