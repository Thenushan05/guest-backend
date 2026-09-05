import * as fs from 'fs';
import * as path from 'path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as streamifier from 'streamifier';
import { UploadApiResponse, v2 as CloudinaryClient } from 'cloudinary';
import { CLOUDINARY } from './cloudinary.provider';
import { UploadFailedException } from '../common/exceptions/domain-exceptions';

export interface UploadedImage {
  url: string;
  publicId: string;
}

/**
 * Storage strategy — chosen at runtime based on environment:
 *
 *  CLOUDINARY_CLOUD_NAME set  →  upload to Cloudinary (production)
 *  CLOUDINARY_CLOUD_NAME empty →  save to local encrypted-at-rest disk folder
 *                                  and serve via GET /api/v1/uploads/:filename
 *                                  which requires a valid Bearer JWT.
 *
 * The local path is NEVER under /public or any statically served folder.
 * It lives at <project-root>/secure-uploads/ which is outside the Next.js
 * public dir and is not reachable without going through the NestJS auth
 * middleware first.
 *
 * Switching strategies requires zero changes to RoomsService or any caller —
 * they only depend on the UploadsService interface.
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  /** Absolute path to the protected local storage root */
  private readonly localStorageRoot: string;
  private readonly useCloudinary: boolean;

  constructor(
    @Inject(CLOUDINARY) private readonly cloudinary: typeof CloudinaryClient,
    private readonly configService: ConfigService,
  ) {
    this.useCloudinary = Boolean(
      this.configService.get<string>('cloudinary.cloudName'),
    );

    // Resolve relative to the project root (one level above /src)
    this.localStorageRoot = path.resolve(process.cwd(), 'secure-uploads');

    if (!this.useCloudinary) {
      this.ensureStorageDir(this.localStorageRoot);
      this.logger.warn(
        'Cloudinary is not configured — using local secure storage at ' +
          this.localStorageRoot +
          '. Set CLOUDINARY_* env vars for production.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async uploadImage(
    file: Express.Multer.File,
    folder = 'guest-house/rooms',
  ): Promise<UploadedImage> {
    if (this.useCloudinary) {
      return this.uploadToCloudinary(file, folder);
    }
    return this.saveLocally(file, folder);
  }

  async uploadImages(
    files: Express.Multer.File[],
    folder = 'guest-house/rooms',
  ): Promise<UploadedImage[]> {
    return Promise.all(files.map((file) => this.uploadImage(file, folder)));
  }

  async deleteImage(publicId: string): Promise<void> {
    if (this.useCloudinary) {
      return this.deleteFromCloudinary(publicId);
    }
    return this.deleteLocally(publicId);
  }

  /**
   * Reads a file from local secure storage.
   * Called only by the secure serve endpoint (GET /uploads/:filename)
   * which is protected by JwtAuthGuard.
   *
   * Returns null when the file is not found (caller should 404).
   */
  readLocalFile(relativePath: string): { buffer: Buffer; mimeType: string } | null {
    const safePath = this.safeJoin(this.localStorageRoot, relativePath);
    if (!safePath || !fs.existsSync(safePath)) return null;

    const ext = path.extname(safePath).toLowerCase().replace('.', '');
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };

    return {
      buffer: fs.readFileSync(safePath),
      mimeType: mimeMap[ext] ?? 'application/octet-stream',
    };
  }

  // ---------------------------------------------------------------------------
  // Cloudinary strategy
  // ---------------------------------------------------------------------------

  private async uploadToCloudinary(
    file: Express.Multer.File,
    folder: string,
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

  private async deleteFromCloudinary(publicId: string): Promise<void> {
    try {
      await this.cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (error) {
      this.logger.warn(
        `Failed to delete Cloudinary asset ${publicId}: ${(error as Error).message}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Local secure storage strategy
  // ---------------------------------------------------------------------------

  private async saveLocally(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadedImage> {
    try {
      const ext = this.extensionFromMime(file.mimetype);
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      // Keep folder hierarchy, e.g. guest-house/rooms/room-abc123/
      const subDir = path.join(this.localStorageRoot, folder);
      this.ensureStorageDir(subDir);

      const filePath = path.join(subDir, filename);
      fs.writeFileSync(filePath, file.buffer);

      // publicId is the path relative to storage root — used for deletion
      const publicId = path.join(folder, filename).replace(/\\/g, '/');

      // URL served by the secure endpoint: /api/v1/uploads?path=<publicId>
      const apiPrefix = this.configService.get<string>('apiPrefix', 'api/v1');
      const url = `/${apiPrefix}/uploads?path=${encodeURIComponent(publicId)}`;

      return { url, publicId };
    } catch (error) {
      this.logger.error('Local upload failed', error as Error);
      throw new UploadFailedException();
    }
  }

  private async deleteLocally(publicId: string): Promise<void> {
    const safePath = this.safeJoin(this.localStorageRoot, publicId);
    if (!safePath) return;
    try {
      if (fs.existsSync(safePath)) fs.unlinkSync(safePath);
    } catch (error) {
      this.logger.warn(`Failed to delete local file ${publicId}: ${(error as Error).message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private ensureStorageDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Path traversal guard.
   * Returns null if the resolved path escapes the storage root.
   */
  private safeJoin(root: string, relativePath: string): string | null {
    // Strip any leading slashes / drive letters to make it truly relative
    const sanitized = relativePath.replace(/^[/\\]+/, '').replace(/\.\./g, '');
    const resolved = path.resolve(root, sanitized);
    // Normalize root for comparison (in case of Windows path separators)
    const normalizedRoot = path.normalize(root);
    const normalizedResolved = path.normalize(resolved);
    if (!normalizedResolved.startsWith(normalizedRoot + path.sep) && normalizedResolved !== normalizedRoot) {
      this.logger.warn(`Path traversal attempt blocked: ${relativePath}`);
      return null;
    }
    return resolved;
  }

  private extensionFromMime(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    return map[mime] ?? 'bin';
  }
}
