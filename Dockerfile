# File-View - File Share Access Management System
# Build tools are included in the default node:22 image, which is needed to
# compile the better-sqlite3 native module.
FROM node:22-bookworm

ENV NODE_ENV=production
WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the application.
COPY . .

# SQLite data lives here; mount a volume to persist it across container restarts.
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000

# ensureAdmin() in server.js creates the default admin on first boot,
# so the app is ready to use immediately.
CMD ["node", "server.js"]
