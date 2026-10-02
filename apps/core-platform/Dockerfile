# RustKorea Unified Platform — 런처 프론트
FROM node:20-slim AS base
WORKDIR /srv/app
ARG API_INTERNAL_URL=http://127.0.0.1:4501
ARG ADMIN_INTERNAL_URL=http://127.0.0.1:4502
ARG NEXT_PUBLIC_PLATFORM_DOMAIN=rustkorea.cloud
ARG NEXT_PUBLIC_ADMIN_URL=/admin
ARG ALLOW_LOCAL_APPS=false
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx prisma generate
RUN npm run build
ENV NODE_ENV=production PORT=4500
EXPOSE 4500
CMD ["npm", "run", "start"]
