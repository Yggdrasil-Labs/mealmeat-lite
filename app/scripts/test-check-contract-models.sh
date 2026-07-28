#!/usr/bin/env bash
#
# test-check-contract-models.sh
# 测试 check-contract-models.sh 能正确检测陈旧文件
#
# 验收标准:
#   - 注入陈旧 DTO 时 checker 非零退出
#   - 输出包含该删除路径
#   - 原 committed source 摘要不变

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

COMMITTED_DIR="$APP_DIR/app/src/main/java/io/yggdrasil/labs/mealmate/lite/contract/generated"

# 创建临时目录
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

TEST_COMMITTED_DIR="$TEMP_DIR/committed"

echo "=== Test: Stale file detection ==="

# 先确保有真实的 committed 文件
if [[ ! -d "$COMMITTED_DIR" ]] || [[ -z "$(ls -A "$COMMITTED_DIR" 2>/dev/null)" ]]; then
  echo "Error: No committed models found. Run generateContractModels first." >&2
  exit 1
fi

# 复制 committed 目录
cp -r "$COMMITTED_DIR" "$TEST_COMMITTED_DIR"

# 计算原始 SHA-256
ORIGINAL_SHA=$(find "$COMMITTED_DIR" -type f -name "*.kt" -exec sha256sum {} \; | sort | sha256sum | cut -d' ' -f1)
echo "Original committed SHA: $ORIGINAL_SHA"

# 注入陈旧文件
STALE_FILE="$TEST_COMMITTED_DIR/StaleContractDto.kt"
cat > "$STALE_FILE" << 'EOF'
package io.yggdrasil.labs.mealmate.lite.contract.generated

// This file should not exist and should be detected as stale
data class StaleContractDto(
    val id: String,
    val name: String
)
EOF

echo "Injected stale file: StaleContractDto.kt"

# 运行 checker，应该失败
echo "Running check-contract-models.sh..."
set +e
OUTPUT=$("$SCRIPT_DIR/check-contract-models.sh" --committed-dir "$TEST_COMMITTED_DIR" 2>&1)
EXIT_CODE=$?
set -e

echo "Exit code: $EXIT_CODE"
echo "Output:"
echo "$OUTPUT"
echo ""

# 验证退出码非零
if [[ $EXIT_CODE -eq 0 ]]; then
  echo "FAIL: Checker should have failed with non-zero exit code" >&2
  exit 1
fi
echo "✓ Checker returned non-zero exit code"

# 验证输出包含陈旧文件路径
if [[ ! "$OUTPUT" =~ "StaleContractDto.kt" ]]; then
  echo "FAIL: Output should mention StaleContractDto.kt" >&2
  exit 1
fi
echo "✓ Output mentions the stale file"

# 验证原 committed source 未被修改
CURRENT_SHA=$(find "$COMMITTED_DIR" -type f -name "*.kt" -exec sha256sum {} \; | sort | sha256sum | cut -d' ' -f1)
if [[ "$CURRENT_SHA" != "$ORIGINAL_SHA" ]]; then
  echo "FAIL: Original committed source was modified!" >&2
  echo "Expected SHA: $ORIGINAL_SHA" >&2
  echo "Current SHA:  $CURRENT_SHA" >&2
  exit 1
fi
echo "✓ Original committed source unchanged"

echo ""
echo "=== All tests passed ==="
