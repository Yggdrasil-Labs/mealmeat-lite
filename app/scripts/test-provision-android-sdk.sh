#!/usr/bin/env bash

set -euo pipefail

readonly repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly provision_script="$repo_root/app/scripts/provision-android-sdk.sh"
readonly temp_root="$(mktemp -d)"
readonly fake_bin="$temp_root/bin"
readonly fake_sdk="$temp_root/sdk"
readonly command_log="$temp_root/android-commands.log"
readonly local_properties="$repo_root/app/local.properties"
readonly local_properties_backup="$temp_root/local.properties.backup"
had_local_properties=0

if [[ -e "$local_properties" ]]; then
  cp "$local_properties" "$local_properties_backup"
  had_local_properties=1
fi

cleanup() {
  if ((had_local_properties)); then
    cp "$local_properties_backup" "$local_properties"
  else
    rm -f "$local_properties"
  fi
  rm -rf "$temp_root"
}
trap cleanup EXIT

mkdir -p "$fake_bin" "$fake_sdk"

cat > "$fake_bin/sdkmanager" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
IFS= read -r _ || true
EOF
chmod +x "$fake_bin/sdkmanager"

cat > "$fake_bin/android" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >> "$ANDROID_TEST_COMMAND_LOG"

if [[ "${FAIL_PROVISION:-0}" == "1" ]]; then
  exit 0
fi

mkdir -p \
  "$ANDROID_HOME/system-images/android-27/default/x86_64" \
  "$ANDROID_HOME/system-images/android-37.0/google_apis_ps16k/x86_64" \
  "$ANDROID_HOME/emulator/lib"
printf '%s\n' \
  'api27-package' > "$ANDROID_HOME/system-images/android-27/default/x86_64/package.xml"
printf '%s\n' \
  'api27-source' > "$ANDROID_HOME/system-images/android-27/default/x86_64/source.properties"
printf '%s\n' \
  'api27-system' > "$ANDROID_HOME/system-images/android-27/default/x86_64/system.img"
printf '%s\n' \
  'api37-package' > "$ANDROID_HOME/system-images/android-37.0/google_apis_ps16k/x86_64/package.xml"
printf '%s\n' \
  'api37-source' > "$ANDROID_HOME/system-images/android-37.0/google_apis_ps16k/x86_64/source.properties"
printf '%s\n' \
  'api37-system' > "$ANDROID_HOME/system-images/android-37.0/google_apis_ps16k/x86_64/system.img"
printf '%s\n' \
  'hardware-properties' > "$ANDROID_HOME/emulator/lib/hardware-properties.ini"
EOF
chmod +x "$fake_bin/android"

export ANDROID_HOME="$fake_sdk"
export ANDROID_SDK_ROOT="$fake_sdk"
export ANDROID_TEST_COMMAND_LOG="$command_log"
export PATH="$fake_bin:$PATH"

bash "$provision_script"

grep -F 'sdk install platforms/android-37.0 build-tools/37.0.0 system-images/android-27/default/x86_64@1 system-images/android-37.0/google_apis_ps16k/x86_64@6' "$command_log" >/dev/null
grep -F "sdk.dir=$fake_sdk" "$local_properties" >/dev/null

: > "$fake_sdk/system-images/android-27/default/x86_64/source.properties"
if FAIL_PROVISION=1 bash "$provision_script" >"$temp_root/empty-artifact.log" 2>&1; then
  echo "provisioning unexpectedly succeeded with an empty SDK artifact" >&2
  exit 1
fi

grep -F 'required Android SDK artifact is missing or empty' "$temp_root/empty-artifact.log" >/dev/null

rm -rf "$fake_sdk/emulator" "$fake_sdk/system-images"
if FAIL_PROVISION=1 bash "$provision_script" >"$temp_root/failure.log" 2>&1; then
  echo "provisioning unexpectedly succeeded with incomplete SDK packages" >&2
  exit 1
fi

grep -F 'required Android SDK artifact is missing or empty' "$temp_root/failure.log" >/dev/null

echo 'provision Android SDK checks passed'
