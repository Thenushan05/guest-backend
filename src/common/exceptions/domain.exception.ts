import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../enums/error-code.enum';

/**
 * Base class for all predictable, business-rule-driven errors.
 * Carries a stable `errorCode` alongside the human-readable message so the
 * global exception filter can build a consistent error envelope.
 */
export class DomainException extends HttpException {
  public readonly errorCode: ErrorCode;

  constructor(errorCode: ErrorCode, message: string, status: HttpStatus) {
    super({ errorCode, message }, status);
    this.errorCode = errorCode;
  }
}

export class NotFoundDomainException extends DomainException {
  constructor(errorCode: ErrorCode, message: string) {
    super(errorCode, message, HttpStatus.NOT_FOUND);
  }
}

export class BadRequestDomainException extends DomainException {
  constructor(errorCode: ErrorCode, message: string) {
    super(errorCode, message, HttpStatus.BAD_REQUEST);
  }
}

export class ConflictDomainException extends DomainException {
  constructor(errorCode: ErrorCode, message: string) {
    super(errorCode, message, HttpStatus.CONFLICT);
  }
}

export class UnauthorizedDomainException extends DomainException {
  constructor(errorCode: ErrorCode, message: string) {
    super(errorCode, message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenDomainException extends DomainException {
  constructor(errorCode: ErrorCode, message: string) {
    super(errorCode, message, HttpStatus.FORBIDDEN);
  }
}
