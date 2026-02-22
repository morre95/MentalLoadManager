# Build stage
FROM node:20-slim AS build
WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps

COPY frontend/ ./
COPY shared/ ../shared/

RUN npm run build

# Runtime stage
FROM node:20-slim
WORKDIR /app

COPY --from=build /app/dist ./dist

# IMPORTANT: serve SPA and fall back to index.html
CMD ["sh", "-c", "npx serve -s dist --single --listen tcp://0.0.0.0:${PORT}"]
