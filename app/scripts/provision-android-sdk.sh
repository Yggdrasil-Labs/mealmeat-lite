#!/usr/bin/env bash

# SDK package IDs follow https://developer.android.com/tools/sdkmanager.
# Gradle Managed Devices download and create their own AOSP system images.
# See https://developer.android.com/reference/tools/gradle-api/4.2/com/android/build/api/dsl/ManagedVirtualDevice.
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

if [[ -z "$sdkmanager" || ! -x "$sdkmanager" ]]; then
  echo "sdkmanager was not found. Install the pinned Android command-line tools first." >&2
  exit 1
fi

# `yes` can receive SIGPIPE after sdkmanager has accepted every license. Preserve
# sdkmanager failures while accepting that expected producer-side termination.
{ yes 2>/dev/null || true; } | "$sdkmanager" --sdk_root="$sdk_root" --licenses >/dev/null

"$sdkmanager" --sdk_root="$sdk_root" --install \
  "platforms;android-36" \
  "build-tools;36.0.0"

# local.properties is ignored by Git but takes precedence over ANDROID_HOME in
# Gradle. Keep it aligned with the SDK path selected by mise on every provision.
printf 'sdk.dir=%s\n' "$sdk_root" > "$app_root/local.properties"
