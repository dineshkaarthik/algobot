#!/bin/sh
# Run database migrations, then start the server
echo "Running database migrations..."
npx drizzle-kit migrate 2>&1 || echo "Migration warning (may already be applied)"
echo "Starting Algo server..."
exec node dist/index.js
