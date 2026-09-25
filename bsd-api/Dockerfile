FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

FROM deps AS build
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
# The seed (prisma/seed.ts, run with tsx) imports shared helpers from src/, so the sources ship too.
COPY --from=build /app/src ./src
COPY package.json ./
EXPOSE 4000
# Applies any pending Prisma migrations, then starts the API. Production was created with `db push`
# before migrations existed, so the first deploy of this image needs the one-off baseline described in
# deploy/v2-migration-runbook.md. Without it `migrate deploy` stops with P3005 and the container restarts in a loop.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
