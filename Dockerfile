# ---------- 1. Build the React client ----------
FROM node:20-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci || npm install
COPY client/ ./
RUN npm run build

# ---------- 2. API + static client in one image ----------
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package*.json ./
RUN (npm ci --omit=dev || npm install --omit=dev) && npm cache clean --force
COPY server/ ./
COPY --from=client /app/client/dist /app/client/dist
RUN mkdir -p uploads/models uploads/tmp && chown -R node:node /app
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:5000/api/health || exit 1
CMD ["node", "src/server.js"]
