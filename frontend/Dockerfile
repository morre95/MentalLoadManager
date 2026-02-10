# Build stage
FROM node:20-slim AS build
WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Runtime stage
FROM node:20-slim
WORKDIR /app

COPY --from=build /app/dist ./dist

# IMPORTANT: serve SPA and fall back to index.html
CMD ["sh", "-c", "ls -la && ls -la dist && npx serve -s dist -l ${PORT} --single"]
