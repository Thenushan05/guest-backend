import { SetMetadata } from '@nestjs/common';

export const RESPONSE_MESSAGE_KEY = 'response_message';

/**
 * Overrides the default "Success" message used by the ResponseInterceptor.
 * Usage: @ResponseMessage('Booking created successfully')
 */
export const ResponseMessage = (message: string) => SetMetadata(RESPONSE_MESSAGE_KEY, message);
