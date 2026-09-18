#!/bin/sh
set -eu

mkdir -p /data
chown nextjs:nodejs /data

if ! su-exec nextjs:nodejs test -w /data; then
  echo "fight_counter_volume_error path=/data reason=not_writable" >&2
  exit 1
fi

exec su-exec nextjs:nodejs "$@"
