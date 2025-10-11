# syntax=docker/dockerfile:1.6

FROM node:20-alpine3.19 AS base

# Set working directory
WORKDIR /app

# Install dependencies
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy application source
COPY . .

# Ensure non-root ownership for runtime
RUN chown -R node:node /app
USER node

# Expose API port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]