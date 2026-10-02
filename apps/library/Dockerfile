# 서브앱 공용 (library/aiplatform/healthcare — basePath 탑재)
ARG APP_PORT=4511
FROM node:20-slim AS base
WORKDIR /srv/app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=${APP_PORT}
EXPOSE ${APP_PORT}
CMD ["npm", "run", "start"]
