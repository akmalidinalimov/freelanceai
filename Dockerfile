# Production image, built ONCE per commit by .github/workflows/image.yml and pulled by
# the VPS (deploy/docker-compose.prod.yml). Replaces the old build-on-boot flow, so a
# VPS restart no longer depends on npm/GitHub/Alpine availability.
#
# Deliberately a single full-fat image (app + node_modules + prisma CLI): the same image
# serves the app container AND the migrate container (`npx prisma migrate deploy`).
# Slimming back to `output: standalone` is a later optimization — correctness first.
FROM node:24-alpine

RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependency layer (cached until the lockfile changes).
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

# Build-time inlined values. S3_PUBLIC_BASE_URL feeds next.config's image-host
# allowlist (public URL, not a secret — set as a GitHub Actions repo VARIABLE).
# The NEXT_PUBLIC_* pair is the Gigora rename lever (docs/rebrand-gigora.md).
ARG S3_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_BRAND_NAME
ARG NEXT_PUBLIC_BRAND_DOMAIN
ARG NEXT_PUBLIC_CLARITY_ID
ARG NEXT_PUBLIC_META_PIXEL_ID
ENV S3_PUBLIC_BASE_URL=$S3_PUBLIC_BASE_URL \
    NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME \
    NEXT_PUBLIC_BRAND_DOMAIN=$NEXT_PUBLIC_BRAND_DOMAIN \
    NEXT_PUBLIC_CLARITY_ID=$NEXT_PUBLIC_CLARITY_ID \
    NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID

RUN npx prisma generate && \
    DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    NEXTAUTH_SECRET="build-dummy" \
    npm run build

ENV NODE_ENV=production
EXPOSE 3000
# Seed is idempotent; app only starts after the migrate service succeeded (compose
# depends_on), so the schema is always current by the time this runs.
CMD ["sh", "-c", "(node prisma/seed-prod.mjs || echo 'seed-prod skipped') && npx next start -H 0.0.0.0 -p 3000"]
