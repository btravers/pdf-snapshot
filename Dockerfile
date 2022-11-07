FROM node:18-slim AS pnpm

ENV CI=1

ARG PNPM_VERSION=7.14.2

RUN apt-get update && \
    apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
RUN npm --no-update-notifier --no-fund --global install pnpm@${PNPM_VERSION}


FROM pnpm AS builder

WORKDIR /app

ARG FOLDER
ENV FOLDER=${FOLDER}

COPY . .

RUN pnpm i --frozen-lockfile
RUN pnpm --filter ./packages/service build
RUN pnpm --filter ./packages/service --prod --frozen-lockfile deploy pruned


FROM node:18-slim as production

WORKDIR /app
EXPOSE 3000

ENV NODE_ENV=production

RUN apt-get update && \
    apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

COPY --from=builder /app/pruned .
COPY --from=builder /app/packages/service/dist ./dist

USER node

EXPOSE ${PORT}

CMD ["node", "dist/server.js"]
