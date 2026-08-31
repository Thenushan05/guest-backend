import { ErrorCode } from '../enums/error-code.enum';
import {
  BadRequestDomainException,
  ConflictDomainException,
  ForbiddenDomainException,
  NotFoundDomainException,
  UnauthorizedDomainException,
} from './domain.exception';

// ---------- Auth ----------
export class InvalidCredentialsException extends UnauthorizedDomainException {
  constructor() {
    super(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password');
  }
}

export class EmailAlreadyExistsException extends ConflictDomainException {
  constructor() {
    super(ErrorCode.EMAIL_ALREADY_EXISTS, 'An account with this email already exists');
  }
}

export class PhoneAlreadyExistsException extends ConflictDomainException {
  constructor() {
    super(ErrorCode.PHONE_ALREADY_EXISTS, 'An account with this phone number already exists');
  }
}

export class InvalidRefreshTokenException extends UnauthorizedDomainException {
  constructor() {
    super(ErrorCode.INVALID_REFRESH_TOKEN, 'Invalid or expired refresh token');
  }
}

export class AccountBlockedException extends ForbiddenDomainException {
  constructor() {
    super(ErrorCode.ACCOUNT_BLOCKED, 'Your account has been blocked. Please contact support.');
  }
}

export class AccountInactiveException extends ForbiddenDomainException {
  constructor() {
    super(ErrorCode.ACCOUNT_INACTIVE, 'Your account is inactive. Please contact support.');
  }
}

// ---------- Users ----------
export class UserNotFoundException extends NotFoundDomainException {
  constructor() {
    super(ErrorCode.USER_NOT_FOUND, 'User not found');
  }
}

// ---------- Rooms ----------
export class RoomNotFoundException extends NotFoundDomainException {
  constructor() {
    super(ErrorCode.ROOM_NOT_FOUND, 'Room not found');
  }
}

export class RoomNotAvailableException extends ConflictDomainException {
  constructor(message = 'Room is not available for the selected dates') {
    super(ErrorCode.ROOM_NOT_AVAILABLE, message);
  }
}

export class RoomInactiveException extends BadRequestDomainException {
  constructor() {
    super(ErrorCode.ROOM_INACTIVE, 'This room is not currently active for booking');
  }
}

export class RoomUnderMaintenanceException extends BadRequestDomainException {
  constructor() {
    super(ErrorCode.ROOM_UNDER_MAINTENANCE, 'This room is currently under maintenance');
  }
}

export class RoomCapacityExceededException extends BadRequestDomainException {
  constructor(maximumGuests: number) {
    super(
      ErrorCode.ROOM_CAPACITY_EXCEEDED,
      `Number of guests exceeds the maximum capacity of ${maximumGuests} for this room`,
    );
  }
}

export class RoomNumberExistsException extends ConflictDomainException {
  constructor() {
    super(ErrorCode.ROOM_NUMBER_EXISTS, 'A room with this room number already exists');
  }
}

export class RoomImageNotFoundException extends NotFoundDomainException {
  constructor() {
    super(ErrorCode.ROOM_IMAGE_NOT_FOUND, 'Room image not found');
  }
}

// ---------- Room types / facilities ----------
export class RoomTypeNotFoundException extends NotFoundDomainException {
  constructor() {
    super(ErrorCode.ROOM_TYPE_NOT_FOUND, 'Room type not found');
  }
}

export class RoomTypeInUseException extends ConflictDomainException {
  constructor() {
    super(
      ErrorCode.ROOM_TYPE_IN_USE,
      'Room type cannot be deleted because rooms are assigned to it',
    );
  }
}

export class FacilityNotFoundException extends NotFoundDomainException {
  constructor() {
    super(ErrorCode.FACILITY_NOT_FOUND, 'Facility not found');
  }
}

// ---------- Bookings ----------
export class BookingNotFoundException extends NotFoundDomainException {
  constructor() {
    super(ErrorCode.BOOKING_NOT_FOUND, 'Booking not found');
  }
}

export class BookingAlreadyProcessedException extends ConflictDomainException {
  constructor(currentStatus: string) {
    super(
      ErrorCode.BOOKING_ALREADY_PROCESSED,
      `Booking has already been processed (current status: ${currentStatus})`,
    );
  }
}

export class BookingNotCancellableException extends BadRequestDomainException {
  constructor(reason: string) {
    super(ErrorCode.BOOKING_NOT_CANCELLABLE, reason);
  }
}

export class InvalidBookingDatesException extends BadRequestDomainException {
  constructor(message: string) {
    super(ErrorCode.INVALID_BOOKING_DATES, message);
  }
}

// ---------- Offers ----------
export class OfferNotFoundException extends NotFoundDomainException {
  constructor() {
    super(ErrorCode.OFFER_NOT_FOUND, 'Offer not found');
  }
}

// ---------- Uploads ----------
export class UploadFailedException extends BadRequestDomainException {
  constructor(detail?: string) {
    super(ErrorCode.UPLOAD_FAILED, detail || 'File upload failed');
  }
}

export class InvalidFileTypeException extends BadRequestDomainException {
  constructor() {
    super(ErrorCode.INVALID_FILE_TYPE, 'Only JPG, PNG and WEBP image files are allowed');
  }
}
