#!/usr/bin/env bash
#
# check-contract-models.sh
# 检查 committed 契约模型是否与权威源一致
#
# 用法:
#   ./check-contract-models.sh [--committed-dir <path>]
#
# 选项:
#   --committed-dir  覆盖默认的 committed source 目录 (用于测试)
#
# 退出码:
#   0 - 一致
#   1 - 不一致或有陈旧文件

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 默认 committed 目录
COMMITTED_DIR="$APP_DIR/app/src/main/java/io/yggdrasil/labs/mealmate/lite/contract/generated"

# 解析参数
while [[ $# -gt 0 ]]; do
  case $1 in
    --committed-dir)
      COMMITTED_DIR="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# 创建临时目录
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

GENERATED_DIR="$TEMP_DIR/generated"

echo "Generating fresh models to compare..."

# 生成新的模型
"$SCRIPT_DIR/generate-contract-models.sh" --output-dir "$GENERATED_DIR"

# 找到生成的 kotlin 源文件目录
GENERATED_SRC="$GENERATED_DIR/src/main/kotlin/io/yggdrasil/labs/mealmate/lite/contract/generated"

if [[ ! -d "$GENERATED_SRC" ]]; then
  echo "Error: Generated source directory not found: $GENERATED_SRC" >&2
  exit 1
fi

echo "Comparing with committed source..."

# 检查是否存在 committed 目录
if [[ ! -d "$COMMITTED_DIR" ]]; then
  echo "Error: Committed directory not found: $COMMITTED_DIR" >&2
  echo "Run generateContractModels task first" >&2
  exit 1
fi

# 检查陈旧文件 (committed 中存在但 generated 中不存在的文件)
STALE_FILES=()
while IFS= read -r -d '' file; do
  relative_path="${file#$COMMITTED_DIR/}"
  if [[ ! -f "$GENERATED_SRC/$relative_path" ]]; then
    STALE_FILES+=("$relative_path")
  fi
done < <(find "$COMMITTED_DIR" -type f -name "*.kt" -print0)

if [[ ${#STALE_FILES[@]} -gt 0 ]]; then
  echo "Error: Found stale files that should be deleted:" >&2
  for file in "${STALE_FILES[@]}"; do
    echo "  - $file" >&2
  done
  exit 1
fi

# 比较文件内容
DIFF_OUTPUT=$(diff -rq "$GENERATED_SRC" "$COMMITTED_DIR" 2>&1) || true

if [[ -n "$DIFF_OUTPUT" ]]; then
  echo "Error: Contract models are out of sync:" >&2
  echo "$DIFF_OUTPUT" >&2
  echo "" >&2
  echo "Run './gradlew :app:generateContractModels' to update" >&2
  exit 1
fi

echo "✓ Contract models are up to date"
exit 0
