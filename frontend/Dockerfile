# Build stage
FROM node:20-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime stage
FROM node:20-slim
WORKDIR /app

# "serve" can be used via npx; or add it to deps for faster boot.
COPY --from=build /app/dist ./dist

# Use PORT from Railway
CMD ["sh", "-c", "npx serve -s dist -l ${PORT}"]
