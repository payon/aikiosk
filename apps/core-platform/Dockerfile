# RustKorea Unified Platform — 런처 프론트
FROM node:20-slim AS base
WORKDIR /srv/app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx prisma generate
RUN npm run build
ENV NODE_ENV=production PORT=4500
EXPOSE 4500
CMD ["npm", "run", "start"]
