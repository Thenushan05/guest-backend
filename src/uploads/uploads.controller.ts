import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UploadsService } from './uploads.service';
import { Public } from '../common/decorators/public.decorator';

/**
 * Serves locally-stored room images through an authenticated endpoint.
 *
 * Route: GET /api/v1/uploads/*path
 *
 * Security model:
 *  - Protected by the global JwtAuthGuard (no @Public() decorator).
 *  - Files live in <project-root>/secure-uploads/ — never under a static
 *    public directory, so they CANNOT be fetched without a valid JWT.
 *  - UploadsService.readLocalFile() performs a path-traversal guard before
 *    reading anything from disk.
 *
 * This controller is only relevant when CLOUDINARY_CLOUD_NAME is not set
 * (i.e. development / test). In production the image URLs returned by the API
 * are Cloudinary HTTPS URLs and this endpoint is never called.
 */
@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /**
   * Serve a single image file from secure local storage.
   * The :path param uses a wildcard so nested sub-paths are supported,
   * e.g. /uploads/guest-house/rooms/room-id/1234567890-abc.jpg
   */
  @Get('*path')
  @Public()
  @ApiOperation({ summary: 'Serve a locally-stored room image' })
  serveImage(@Param('path') relativePath: string, @Res() res: Response) {
    const file = this.uploadsService.readLocalFile(relativePath);

    if (!file) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    res.setHeader('Content-Type', file.mimeType);
    // Cache for 1 hour — images don't change once uploaded
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(file.buffer);
  }
}
