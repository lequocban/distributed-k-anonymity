FROM node:18-alpine

WORKDIR /usr/src/app

# Copy dependency specifications
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy shared configuration and authentication files
COPY config.js auth.js ./

# Copy Node A application files
COPY node-a/ ./node-a/

EXPOSE 3001

CMD ["node", "node-a/index.js"]
