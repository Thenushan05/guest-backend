import { Inject, Injectable, Logger } from '@nestjs/common';
import { UploadApiResponse, v2 as CloudinaryClient } from 'cloudinary';
import * as streamifier from 'streamifier';
import { CLOUDINARY } from './cloudinary.provider';
import { UploadFailedException } from '../common/exceptions/domain-exceptions';

export interface UploadedImage {
  url: string;
  publicId: string;
}

/**
 * Thin abstraction over the actual storage provider (Cloudinary in
 * production). Room/gallery business logic depends only on this service's
 * interface, so the underlying storage implementation can be swapped (e.g.
 * for S3 or local disk) without touching any calling module.
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(@Inject(CLOUDINARY) private readonly cloudinary: typeof CloudinaryClient) {}

  async uploadImage(
    file: Express.Multer.File,
    folder = 'guest-house/rooms',
  ): Promise<UploadedImage> {
    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const uploadStream = this.cloudinary.uploader.upload_stream(
          { folder, resource_type: 'image' },
          (error, uploadResult) => {
            if (error || !uploadResult) return reject(error);
            resolve(uploadResult);
          },
        );
        streamifier.createReadStream(file.buffer).pipe(uploadStream);
      });

      return { url: result.secure_url, publicId: result.public_id };
    } catch (error) {
      this.logger.error('Cloudinary upload failed', error as Error);
      throw new UploadFailedException();
    }
  }

  async uploadImages(
    files: Express.Multer.File[],
    folder = 'guest-house/rooms',
  ): Promise<UploadedImage[]> {
    return Promise.all(files.map((file) => this.uploadImage(file, folder)));
  }

  async deleteImage(publicId: string): Promise<void> {
    try {
      await this.cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (error) {
      this.logger.warn(
        `Failed to delete Cloudinary asset ${publicId}: ${(error as Error).message}`,
      );
    }
  }
}
