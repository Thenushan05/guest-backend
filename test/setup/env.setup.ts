/**
 * Loaded by Jest before any test module is imported (via setupFiles in jest-e2e.json).
 * Reads .env.test so all process.env values are available before NestJS boots.
 * override: true ensures .env.test values win over any previously-loaded .env.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

