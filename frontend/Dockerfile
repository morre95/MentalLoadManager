# Build stage
FROM node:20-slim AS build
WORKDIR /app

# Copy only frontend package manifests
COPY frontend/package*.json ./
RUN npm ci

# Copy only frontend source
COPY frontend/ ./

# Build
RUN npm run build


# Runtime stage
FROM node:20-slim
WORKDIR /app

# Copy built assets
COPY --from=build /app/dist ./dist

# Start static server on Railway PORT
CMD ["sh", "-c", "npx serve -s dist -l ${PORT}"]
