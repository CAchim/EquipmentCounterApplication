# Install dependencies only when needed
FROM node:16 AS deps
WORKDIR /client-app
COPY package*.json ./
RUN npm install

# Rebuild the source code only when needed
FROM node:16 AS builder
WORKDIR /client-app
COPY . .
COPY --from=deps /client-app/node_modules ./node_modules
RUN npm run build

# Production image, copy all the files and run next
FROM node:16 AS runner
WORKDIR /client-app

#ENV NODE_ENV production

# You only need to copy next.config.js if you are NOT using the default configuration
COPY --from=builder /client-app/next.config.js ./
COPY --from=builder /client-app/public ./public
COPY --from=builder --chown=nextjs:nodejs /client-app/.next ./.next
COPY --from=builder /client-app/node_modules ./node_modules
COPY --from=builder /client-app/package.json ./package.json

USER nextjs

EXPOSE 80

ENV PORT 80

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry.
# ENV NEXT_TELEMETRY_DISABLED 1

CMD ["node_modules/.bin/next", "start"]