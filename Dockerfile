FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared-types ./shared-types
COPY shared-validation ./shared-validation

RUN npm ci
RUN npm run build --workspace=@ghaarfix/shared-types 2>/dev/null || (cd shared-types && npm run build)

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY shared-types ./shared-types
COPY shared-validation ./shared-validation

RUN npm ci --omit=dev
RUN cd shared-types && npm run build

COPY --from=builder /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/server.js"]
