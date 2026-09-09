# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS client-build
WORKDIR /app
COPY client/package.json ./client/package.json
RUN npm install --prefix client --no-audit --no-fund
COPY client ./client
RUN npm run build --prefix client

FROM node:22-alpine AS server-deps
WORKDIR /app
COPY server/package.json ./server/package.json
RUN npm install --prefix server --omit=dev --no-audit --no-fund

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app

COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server ./server
COPY --from=client-build /app/client/dist ./client/dist

RUN chown -R node:node /app
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
