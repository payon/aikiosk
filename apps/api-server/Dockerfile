# RustKorea — 백엔드 API (Express, 빌드 불필요)
FROM node:20-slim AS base
WORKDIR /srv/app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --no-audit --no-fund
COPY . .
RUN npx prisma generate
ENV NODE_ENV=production PORT=4501
EXPOSE 4501
CMD ["node", "server.js"]
