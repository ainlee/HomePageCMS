#!/bin/sh
# Baked layout: the code ships inside the image at /app, start in place.
# Living layout: /app is the mounted RELEASES directory (never the symlink
# itself: a bind mount of the link would freeze the container on the
# release that existed at create time). The updater publishes r-<id>
# snapshots plus a "current" link, so /app/server.js does not exist and
# the code path is /app/current.
if [ -f /app/server.js ]; then
  APP_DIR=/app
else
  APP_DIR=/app/current
fi

# First boot of a fresh living install: no release exists until the updater
# clones and publishes. Wait (bounded - it finishes within minutes) instead
# of exit/crash-loop.
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
