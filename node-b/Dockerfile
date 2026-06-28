FROM node:18-alpine

WORKDIR /usr/src/app

# Copy dependency specifications
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy shared configuration and authentication files
COPY config.js auth.js ./

# Copy Node B application files
COPY node-b/ ./node-b/

EXPOSE 3002

CMD ["node", "node-b/index.js"]
