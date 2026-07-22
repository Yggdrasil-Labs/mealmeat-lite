#!/usr/bin/env bash

# Runs Gradle Managed Device tests with an ADB server available first. On this
# WSL host, `adb start-server` can hang while `adb nodaemon server` is healthy.
set -euo pipefail

if (($# == 0)); then
  echo "Usage: $0 <gradle-command> [arguments...]" >&2
  exit 64
fi

readonly sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"

if [[ -z "$sdk_root" ]]; then
  echo "ANDROID_HOME or ANDROID_SDK_ROOT must point to the Android SDK." >&2
  exit 1
fi

readonly adb="$sdk_root/platform-tools/adb"

if [[ ! -x "$adb" ]]; then
  echo "adb was not found at $adb." >&2
  exit 1
fi

adb_pid=""
adb_log=""

cleanup() {
  if [[ -n "$adb_pid" ]] && kill -0 "$adb_pid" 2>/dev/null; then
    kill "$adb_pid" 2>/dev/null || true
    wait "$adb_pid" 2>/dev/null || true
  fi
  if [[ -n "$adb_log" ]]; then
    rm -f "$adb_log"
  fi
}
trap cleanup EXIT

if ! timeout 10s "$adb" start-server >/dev/null 2>&1; then
  adb_log="$(mktemp)"
  "$adb" nodaemon server >"$adb_log" 2>&1 &
  adb_pid="$!"

  for _ in {1..20}; do
    if timeout 2s "$adb" devices >/dev/null 2>&1; then
      break
    fi
    if ! kill -0 "$adb_pid" 2>/dev/null; then
      cat "$adb_log" >&2
      exit 1
    fi
    sleep 1
  done

  if ! timeout 2s "$adb" devices >/dev/null 2>&1; then
    cat "$adb_log" >&2
    echo "ADB server did not become ready." >&2
    exit 1
  fi
fi

"$@"
