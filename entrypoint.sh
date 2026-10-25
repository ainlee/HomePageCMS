#!/bin/sh
# Baked layout: the code ships inside the image at /app, start in place.
# Living layout: /app is the mounted releases directory. The updater
# publishes r-<id> snapshots and points the "current" symlink at the active
# one; resolving the link PER REQUEST (through the container filesystem, not
# at mount time) is what lets a running container follow the switch.
if [ -d /app/current ] && [ ! -f /app/server.js ]; then
  APP_DIR=/app/current
else
  APP_DIR=/app
fi

# First boot of a fresh living install: the releases directory is still
# empty until the updater clones and publishes. Wait (bounded - the updater
# finishes within minutes) instead of exit/crash-loop.
if [ ! -f "$APP_DIR/server.js" ]; then
  echo "waiting for a published release under $APP_DIR ..."
  i=0
  while [ ! -f "$APP_DIR/server.js" ] && [ $i -lt 60 ]; do
    sleep 5
    i=$((i + 1))
  done
  if [ ! -f "$APP_DIR/server.js" ]; then
    echo "no release after 300s; starting anyway - the healthcheck will show unhealthy"
  fi
fi

cd "$APP_DIR"
exec node server.js
