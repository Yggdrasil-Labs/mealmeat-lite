#!/usr/bin/env bash

# Stable Android 17 packages follow https://developer.android.com/about/versions/17/setup-sdk.
# Gradle Managed Devices download and create their required system images.
# See https://developer.android.com/reference/tools/gradle-api/9.3/com/android/build/api/dsl/ManagedVirtualDevice.
set -euo pipefail

if [[ -n "${ANDROID_HOME:-}" && -n "${ANDROID_SDK_ROOT:-}" && "$ANDROID_HOME" != "$ANDROID_SDK_ROOT" ]]; then
  echo "ANDROID_HOME and ANDROID_SDK_ROOT must match when both are set." >&2
  exit 1
fi

readonly sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
readonly app_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "$sdk_root" ]]; then
  echo "ANDROID_HOME or ANDROID_SDK_ROOT must point to the Android SDK." >&2
  exit 1
fi

sdkmanager="$sdk_root/cmdline-tools/latest/bin/sdkmanager"
if [[ ! -x "$sdkmanager" ]]; then
  sdkmanager="$(command -v sdkmanager || true)"
fi

android_cli="$(command -v android || true)"
if [[ -z "$sdkmanager" || ! -x "$sdkmanager" || -z "$android_cli" || ! -x "$android_cli" ]]; then
  echo "The android CLI and sdkmanager were not found. Install the pinned Android command-line tools first." >&2
  exit 1
fi

# The new Android CLI has no license subcommand yet, so retain sdkmanager only
# for noninteractive acceptance and use the supported CLI for package installs.
# `yes` may receive SIGPIPE after every license has been accepted.
{ yes 2>/dev/null || true; } | "$sdkmanager" --sdk_root="$sdk_root" --licenses >/dev/null

"$android_cli" --no-metrics sdk install \
  platforms/android-37.0 \
  build-tools/37.0.0

# local.properties is ignored by Git but takes precedence over ANDROID_HOME in
# Gradle. Keep it aligned with the SDK path selected by mise on every provision.
printf 'sdk.dir=%s\n' "$sdk_root" > "$app_root/local.properties"
