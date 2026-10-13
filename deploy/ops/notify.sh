#!/usr/bin/env bash
# notify.sh "subject" "message" — send an alert through Hermes (iMessage/Telegram).
# Target comes from /etc/nicelydone/ops.env (NOTIFY_TARGET=...), never from the repo.
set -u
[ -r /etc/nicelydone/ops.env ] && . /etc/nicelydone/ops.env
logger -t nicelydone "$1: $2"
[ -n "${NOTIFY_TARGET:-}" ] || exit 0
sudo -u "${NOTIFY_USER:-opc}" bash -c 'export PATH=$HOME/.local/bin:$PATH; hermes send -q --to "$0" -s "$1" "$2"' "$NOTIFY_TARGET" "$1" "$2" || true
