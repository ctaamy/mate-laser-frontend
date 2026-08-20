# syntax = docker/dockerfile:1

# Alineado con la versión de Node que usa el resto del pipeline (CI), no la
# que propuso el generador de Fly.io por defecto.
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Vite"

# Vite app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY package-lock.json package.json ./
RUN npm ci --include=dev

# Copy application code
COPY . .

# Vite hornea estas variables DENTRO del bundle en tiempo de build (no se
# leen en runtime) — por eso hacen falta acá como build args, no alcanza con
# cargarlas como "Environment Variables" en Fly (esas solo llegan al
# container ya corriendo, después de que el build ya terminó).
ARG VITE_API_URL
ARG VITE_MP_PUBLIC_KEY
ARG VITE_UMAMI_WEBSITE_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MP_PUBLIC_KEY=$VITE_MP_PUBLIC_KEY
ENV VITE_UMAMI_WEBSITE_ID=$VITE_UMAMI_WEBSITE_ID

# Build application
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev


# Final stage for app image
FROM base

# Copy built application (incluye node_modules ya podado, con "serve" adentro
# — es dependencia de package.json, no devDependency)
COPY --from=build /app /app

# "serve" en vez de nginx: lee public/serve.json (copiado a dist/ por Vite en
# el build) para las cabeceras de seguridad — X-Frame-Options, CSP, HSTS.
# Con nginx ese archivo se ignora en silencio y quedan sin aplicar.
EXPOSE 8080
CMD [ "npx", "serve", "-s", "dist", "-l", "8080" ]
