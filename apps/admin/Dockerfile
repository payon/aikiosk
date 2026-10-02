# RustKorea — 어드민 프론트 (/admin basePath)
FROM node:20-slim AS base
WORKDIR /srv/app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=4502
EXPOSE 4502
CMD ["npm", "run", "start"]
