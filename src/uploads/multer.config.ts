import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import { InvalidFileTypeException } from '../common/exceptions/domain-exceptions';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Shared Multer configuration: files are buffered in memory (never written
 * to local disk) so they can be streamed straight to Cloudinary.
 */
export const multerImageOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 10 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return callback(new InvalidFileTypeException(), false);
    }
    callback(null, true);
  },
};
