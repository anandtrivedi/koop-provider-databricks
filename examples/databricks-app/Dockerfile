# Dockerfile for Databricks Apps
FROM --platform=linux/amd64 node:18-alpine

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Create app directory
WORKDIR /usr/src/app

# Copy everything (including the provider-lib subdirectory if present)
COPY . .

# Install dependencies
RUN npm ci --only=production

# Set environment variables
# Note: Databricks Apps uses port 8000 (not 8080)
ENV NODE_ENV=production

# Expose port 8000 (Databricks Apps default)
EXPOSE 8000

# Health check for container orchestration
# Use PORT environment variable which defaults to 8000 in Databricks Apps
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8000) + '/databricks/rest/info', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD [ "npm", "start" ]
