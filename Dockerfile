# ---------- Build Stage ----------
FROM node:22-slim AS builder

WORKDIR /app

# Install dependencies (using lockfile to ensure consistency)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and Prisma schema/migrations
COPY . .

# Generate Prisma Client — no DB connection required at this step
RUN npx prisma generate

# Build frontend (Vite outputs to dist/)
RUN npm run build

# ---------- Production Stage ----------
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy everything the runtime needs
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/.env.example ./.env.example

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx server.ts"]