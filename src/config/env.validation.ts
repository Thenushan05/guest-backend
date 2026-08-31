import * as Joi from 'joi';

/**
 * Validates required environment variables at application bootstrap.
 * Fails fast with a clear error instead of surfacing obscure runtime errors later.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3001'),

  DATABASE_URL: Joi.string().required(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  CLOUDINARY_CLOUD_NAME: Joi.string().allow('').optional(),
  CLOUDINARY_API_KEY: Joi.string().allow('').optional(),
  CLOUDINARY_API_SECRET: Joi.string().allow('').optional(),

  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(20),
  AUTH_THROTTLE_TTL: Joi.number().default(60),
  AUTH_THROTTLE_LIMIT: Joi.number().default(5),

  SEED_ADMIN_EMAIL: Joi.string().email().optional(),
  SEED_ADMIN_PASSWORD: Joi.string().optional(),
});
