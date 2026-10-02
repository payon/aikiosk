# RustKorea — 어드민 프론트 (/admin basePath)
FROM node:20-slim AS base
WORKDIR /srv/app
ARG API_INTERNAL_URL=http://127.0.0.1:4501
ARG NEXT_PUBLIC_LAUNCHER_URL=/
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=4502
EXPOSE 4502
CMD ["npm", "run", "start"]
