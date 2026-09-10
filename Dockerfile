FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

# Install openssl for Prisma compatibility
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy manifests first so dependency installation can be cached by the platform.
COPY package.json package-lock.json turbo.json tsconfig.json ./
COPY apps/gateway/package.json apps/gateway/package.json
COPY packages/context-core/package.json packages/context-core/package.json
COPY packages/db/package.json packages/db/package.json

# Prisma needs the schema file for postinstall generate
COPY packages/db/prisma ./packages/db/prisma

RUN npm ci --omit=dev --no-audit --no-fund

# Copy application source, and the default local persona.
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY init.sql persona.example.md ./

# The public repo intentionally ships no private persona. This fallback keeps the
# gateway runnable; replace persona.md in a private deployment if desired.
RUN cp persona.example.md persona.md && touch AGENTS.md

RUN npm run db:generate

EXPOSE 3001

# Render and Railway provide PORT at runtime; http-server.ts reads it.
CMD ["sh", "-c", "npm run db:migrate:deploy && npm run --workspace gateway start"]
