import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  ANTHROPIC_API_KEY: z.string(),
  OPENAI_API_KEY: z.string().optional(),
  LLM_PRIMARY: z.enum(['claude', 'openai']).default('claude'),

  ALGONIT_API_URL: z.string(), // e.g. https://www.algonit.com/api/algo
  ALGONIT_WEBHOOK_SECRET: z.string().optional(), // HMAC-SHA256 webhook signing secret
  TOKEN_ENCRYPTION_KEY: z.string().length(64), // 32 bytes hex-encoded for AES-256-GCM

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.coerce.number().default(3600),
  REFRESH_TOKEN_EXPIRES_IN: z.coerce.number().default(604800),

  RATE_LIMIT_CHAT: z.coerce.number().default(30),
  RATE_LIMIT_AUTH: z.coerce.number().default(5),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env;

export function loadEnv(): Env {
  if (_env) return _env;
  _env = envSchema.parse(process.env);
  return _env;
}

export function getEnv(): Env {
  if (!_env) throw new Error('Environment not loaded. Call loadEnv() first.');
  return _env;
}
