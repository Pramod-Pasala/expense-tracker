# syntax=docker/dockerfile:1

# =============================================================================
# Stage 1: deps — install dependencies
# =============================================================================
FROM node:20-alpine AS deps

# Check for updates to Alpine packages
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package manifests first to leverage Docker layer caching
COPY package.json package-lock.json* ./

# Install dependencies (including devDependencies needed for the build)
RUN npm ci

# =============================================================================
# Stage 2: builder — build Next.js with standalone output
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the application source
COPY . .

# Set build-time environment variables
ENV NODE_ENV=production
ENV PORT=8084

# Build the Next.js application (standalone output is configured in next.config.ts)
RUN npm run build

# =============================================================================
# Stage 3: runner — minimal production image
# =============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8084
ENV NEXT_TELEMETRY_DISABLED=1
# Tell Next.js standalone server to bind to all interfaces
ENV HOSTNAME=0.0.0.0

# Create a non-root user/group (next:nodejs) for security
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 next

# Copy the standalone server output (includes a minimal node_modules)
COPY --from=builder --chown=next:nodejs /app/.next/standalone ./
# Copy static assets required for serving the app
COPY --from=builder --chown=next:nodejs /app/.next/static ./.next/static
# Copy public assets
COPY --from=builder --chown=next:nodejs /app/public ./public

# Switch to the non-root user
USER next

# Expose the application port
EXPOSE 8084

# Healthcheck — poll the /api/health endpoint via wget (busybox-provided)
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8084/api/health || exit 1

# Run the standalone Next.js server
CMD ["node", "server.js"]
