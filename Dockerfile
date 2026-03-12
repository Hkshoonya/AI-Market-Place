# ============================================================
# AI Market Cap — Production Dockerfile
# Multi-stage build for Next.js standalone output
# ============================================================

# ── Stage 1: Install dependencies ──────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

RUN npm install --ignore-scripts --prefer-offline

# ── Stage 2: Build the application ────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects telemetry — disable it during build
ENV NEXT_TELEMETRY_DISABLED=1

# Sentry source map upload during build (token provided via Railway build args)
ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

# NEXT_PUBLIC_* vars are inlined at build time by Next.js — they MUST have
# real values here, not placeholders. Railway auto-passes env vars as build
# args when ARG directives are present.
ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

RUN npm run build

# ── Stage 3: Production runner ─────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only what's needed for standalone mode
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy custom server and cron scheduler
COPY --from=builder --chown=nextjs:nodejs /app/server ./server
# Copy node-cron from node_modules (needed at runtime)
COPY --from=builder /app/node_modules/node-cron ./node_modules/node-cron

USER nextjs

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"

CMD ["node", "server/custom-server.js"]
