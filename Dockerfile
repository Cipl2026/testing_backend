# ==========================================
# Build Stage
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

COPY shared-types ./shared-types
COPY shared-validation ./shared-validation

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

# Build shared packages
RUN cd shared-types && npm run build
RUN cd shared-validation && npm run build

# Build backend
RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build


# ==========================================
# Production Stage
# ==========================================
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy everything needed from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/shared-types ./shared-types
COPY --from=builder /app/shared-validation ./shared-validation

COPY --from=builder /app/dist ./dist

EXPOSE 8008

CMD ["node", "dist/server.js"]