FROM node:18-alpine

WORKDIR /usr/src/app

# Copy dependency specifications
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy shared configuration file
COPY config.js ./

# Copy Coordinator application and public assets
COPY coordinator/ ./coordinator/

EXPOSE 3000

CMD ["node", "coordinator/index.js"]
