# ==========================================
# Stage 1: Build
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Root package files
COPY package.json package-lock.json ./

# Copy workspace packages
COPY shared-types ./shared-types
COPY shared-validation ./shared-validation

# Install all dependencies including devDependencies
RUN npm ci

# Build shared packages first
RUN cd shared-types && npm run build

RUN cd shared-validation && npm run build

# Copy backend source
COPY tsconfig.json ./
COPY src ./src

# Build backend
RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build


# ==========================================
# Stage 2: Production
# ==========================================
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Root package files
COPY package.json package-lock.json ./

# Copy workspace package definitions
COPY shared-types ./shared-types
COPY shared-validation ./shared-validation

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled backend
COPY --from=builder /app/dist ./dist

# Copy compiled shared packages
COPY --from=builder /app/shared-types/dist ./shared-types/dist
COPY --from=builder /app/shared-validation/dist ./shared-validation/dist

EXPOSE 8008

CMD ["node", "dist/server.js"]