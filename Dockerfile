# The HomePageCMS image. It carries the application only: every deployment
# value (paths, port, preview URL, base path, revalidate URL, password) is an
# environment variable set in the compose file, so one image works anywhere.
FROM node:22-alpine

WORKDIR /app

# Dependencies come from the lockfile; node_modules is kept out of the build
# context (see .dockerignore), so this is the only copy in the image.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# The application. Locales, themes and the config examples ship with the image;
# user-made additions are supplied on the host through volumes, never baked in.
COPY server.js ./
COPY lib/ ./lib/
COPY public/ ./public/
COPY locales/ ./locales/
COPY themes/ ./themes/
COPY config/*.example.yaml ./config/

# The host's Homepage config directory is mounted at /app/config and the cms/
# subdirectory of that same directory (the editor's settings file and backups) is
# mounted at /app/cms; neither is part of the image. Run as the unprivileged node
# user (uid 1000): most Linux installations own the first regular user's files as
# 1000:1000, so files the editor writes keep the ownership Homepage expects. If the
# host uses a different uid, adjust the user here and check after the first write.
USER node

ENV NODE_ENV=production
EXPOSE 3456

# The living layout runs the code from a mounted release
# (./updates/releases/current -> /app) that the updater sidecar publishes.
# Before that first publish, /app is empty; the entry point waits instead of
# crashing, so the container shows "waiting" rather than a restart storm.
# With a baked image /app/server.js exists at start and the loop never fires.
COPY entrypoint.sh /entrypoint.sh

# Ask the editor itself for /api/auth. When the editor is mounted under a base
# path, that path is part of the URL, so it is read from the environment instead
# of being hardcoded here.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "const p=(process.env.HOMEPAGE_CMS_BASE_PATH||'');fetch('http://127.0.0.1:'+(process.env.PORT||'3456')+p+'/api/auth').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# No exec bit needed: the script is invoked through sh, so the image
# never runs code with a mode a non-root build user could not set.
CMD ["sh", "/entrypoint.sh"]
