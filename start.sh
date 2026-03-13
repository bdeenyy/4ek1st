#!/bin/sh
# Exit immediately if a command exits with a non-zero status
set -e

echo "Starting application and configuring database for Amvera..."

# Apply Prisma migrations (this creates the database tables if they don't exist)
# Npx will download the prisma CLI momentarily if it's not present (perfect for standalone images)
echo "Applying database schema..."
npx --yes prisma db push --accept-data-loss

# Run the seed script compiled to vanilla JS during the Docker build
echo "Seeding database..."
node prisma/seed.js || echo "Seeding failed or already seeded"

# Start the Next.js standalone application
echo "Starting Next.js..."
exec node server.js
