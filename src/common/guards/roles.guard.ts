import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ForbiddenDomainException } from '../exceptions/domain.exception';
import { ErrorCode } from '../enums/error-code.enum';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Restricts access based on the role embedded in the validated JWT payload.
 * The role is NEVER read from the request body - only from `request.user`,
 * which is set exclusively by JwtStrategy after verifying the token signature.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenDomainException(
        ErrorCode.FORBIDDEN,
        'You do not have permission to access this resource',
      );
    }

    return true;
  }
}
