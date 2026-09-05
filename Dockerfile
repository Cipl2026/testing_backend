# ==========================================
# Build Stage
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json ./

# Copy shared workspace packages
COPY shared-types ./shared-types
COPY shared-validation ./shared-validation

# Install dependencies
RUN npm install

# Copy backend source
COPY tsconfig.json ./
COPY src ./src

# Build shared packages first
RUN cd shared-types && npm run build

RUN cd shared-validation && npm run build

# Build backend
RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build


# ==========================================
# Production Stage
# ==========================================
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy package information
COPY package.json ./

# Copy installed dependencies
COPY --from=builder /app/node_modules ./node_modules

# Copy shared workspace packages (including dist)
COPY --from=builder /app/shared-types ./shared-types
COPY --from=builder /app/shared-validation ./shared-validation

# Copy backend build
COPY --from=builder /app/dist ./dist

EXPOSE 8008

CMD ["node", "dist/server.js"]