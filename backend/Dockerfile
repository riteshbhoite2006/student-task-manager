FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_FILE=/app/data/tasks.json

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY src ./src

# Data dir owned by the non-root user so a mounted volume is writable
RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "src/server.js"]
