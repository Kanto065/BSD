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
COPY package.json ./
EXPOSE 4000
# Using `db push` until the first real `prisma migrate dev` is run against a dev
# database (none is available yet) — switch to `migrate deploy` once migration
# files exist in prisma/migrations.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/server.js"]
