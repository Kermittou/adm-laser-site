# Site ADM Laser — image de production pour Dokploy (Next.js en mode « standalone »).
# Dokploy : type de build « Dockerfile », port 3000. Les secrets (Stripe, SMTP, Boxtal) se
# règlent dans l'onglet Environment de Dokploy, jamais dans ce fichier — voir DEPLOIEMENT.md.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# URL publique du site (liens absolus, sitemap, données Google) : figée au build.
ARG NEXT_PUBLIC_SITE_URL=https://www.adm-laser.fr
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run test && npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
CMD ["node", "server.js"]
