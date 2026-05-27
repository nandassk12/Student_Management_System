# ─────────────────────────────────────────────────────────────
# Stage: development
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (layer cache optimization)
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start Vite dev server with host flag to accept external connections
CMD ["npm", "run", "dev", "--", "--host"]
