# Dockerfile for Databricks Apps and Docker deployments
FROM --platform=linux/amd64 node:18-alpine

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies (including Koop CLI from devDependencies)
RUN npm install

# Bundle app source
COPY . .

# Set environment variables
ENV PORT=8080
ENV NODE_ENV=production

# Expose port
EXPOSE 8080

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/databricks/rest/info', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD [ "npm", "start" ]
