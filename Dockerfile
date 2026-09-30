# Southampton RouteLoop city centre demo: a static site served by Caddy.
# Railway always builds from a Dockerfile when it finds one at the root.

# Stage 1: refresh the generated lists (module preloads in index.html, and the
# service worker's precache list and version). Doing it here means a deploy is
# never stale, even if `node scripts/sw-manifest.mjs` was not run before pushing.
FROM node:22-alpine AS lists
WORKDIR /app
COPY scripts/sw-manifest.mjs scripts/sw-manifest.mjs
COPY site site
RUN node scripts/sw-manifest.mjs

# Stage 2: the web server. The image's working directory is /srv and its start
# command is `caddy run --config /etc/caddy/Caddyfile --adapter caddyfile`.
FROM caddy:2.11.4-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=lists /app/site /srv/site

# Check the config at build time, so a broken Caddyfile fails the build
# instead of the live site.
RUN caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

# Railway injects $PORT at run time and the Caddyfile listens on it.
# Anywhere else it falls back to 8080.
EXPOSE 8080
