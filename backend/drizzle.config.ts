import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/models/*.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://algo:password@localhost:5432/algo_db',
  },
});
