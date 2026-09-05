import { Controller, Get, All, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UploadsService } from './uploads.service';
import { Public } from '../common/decorators/public.decorator';
import { Request } from 'express';

/**
 * Serves locally-stored room images.
 *
 * Routes:
 *  - GET /api/v1/uploads?path=<relative-path> — serves an image by query parameter
 *
 * Security model:
 *  - Marked @Public() to allow unauthenticated access (images are read-only).
 *  - Files live in <project-root>/secure-uploads/ — never under a static public directory.
 *  - UploadsService.readLocalFile() performs a path-traversal guard before reading anything.
 *
 * This controller is only relevant when CLOUDINARY_CLOUD_NAME is not set
 * (i.e. development / test). In production the image URLs are Cloudinary HTTPS URLs.
 */
@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /**
   * Test endpoint to verify the controller is being called.
   */
  @Get('test')
  @Public()
  testRoute(): { message: string } {
    return { message: 'Uploads controller is working!' };
  }

  /**
   * Serve a single image file from secure local storage by relative path.
   * Usage: GET /api/v1/uploads?path=guest-house/rooms/room-id/filename.jpg
   */
  @Get('')
  @Public()
  @ApiOperation({ summary: 'Serve a locally-stored room image' })
  serveImage(@Req() req: Request, @Res() res: Response) {
    const relativePath = (req.query.path as string) || '';

    if (!relativePath) {
      return res.status(400).json({ success: false, message: 'Missing path parameter' });
    }

    const file = this.uploadsService.readLocalFile(relativePath);

    if (!file) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(file.buffer);
  }
}
