import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';

export interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

/**
 * Wraps every successful controller response in a consistent envelope:
 * { success: true, message, data }.
 * Paginated results (which already carry `data` + `pagination`) are passed
 * through as the `data` payload so their shape is preserved.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, SuccessResponse<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<SuccessResponse<T>> {
    const message =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || 'Success';

    return next.handle().pipe(
      map((data) => ({
        success: true,
        message,
        data: data ?? null,
      })),
    );
  }
}
