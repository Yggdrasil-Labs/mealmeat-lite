#!/usr/bin/env bash
#
# generate-contract-models.sh
# 使用 OpenAPI Generator 7.22.0 生成 Kotlin DTO
#
# 用法:
#   ./generate-contract-models.sh --output-dir <absolute-path>
#
# 要求:
#   - Java 21+
#   - 网络访问 (首次下载 CLI)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$APP_DIR/.." && pwd)"

# OpenAPI Generator CLI 版本和 SHA-256
OPENAPI_GENERATOR_VERSION="7.22.0"
OPENAPI_GENERATOR_SHA256="3f1e6ce5c6ad4f15242c6170ab43aad4bad771622617eeece4a7d4f72ffaf329"
OPENAPI_GENERATOR_JAR="openapi-generator-cli-${OPENAPI_GENERATOR_VERSION}.jar"
TOOLS_DIR="$APP_DIR/build/contract-tools"

# 解析参数
OUTPUT_DIR=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$OUTPUT_DIR" ]]; then
  echo "Error: --output-dir is required" >&2
  exit 1
fi

# 输出只能落在受控的 build 或 /tmp staging 根下。生成器绝不清理调用方给出的
# 目录：已有内容意味着调用方没有提供 fresh staging directory，应明确失败而非 rm -rf。
if [[ ! "$OUTPUT_DIR" = /* ]]; then
  echo "Error: --output-dir must be an absolute path" >&2
  exit 1
fi

PROJECT_BUILD_DIR="$(realpath -m "$APP_DIR/build")"
APP_MODULE_BUILD_DIR="$(realpath -m "$APP_DIR/app/build")"
OUTPUT_DIR="$(realpath -m "$OUTPUT_DIR")"

case "$OUTPUT_DIR" in
  "$PROJECT_BUILD_DIR"/*|"$APP_MODULE_BUILD_DIR"/*|/tmp/*)
    ;;
  *)
    echo "Error: --output-dir must be below $PROJECT_BUILD_DIR, $APP_MODULE_BUILD_DIR, or /tmp" >&2
    exit 1
    ;;
esac

# 防止允许根内的 symlink 将写入重定向到不受控位置。
path_component="$OUTPUT_DIR"
while [[ "$path_component" != "/" ]]; do
  if [[ -L "$path_component" ]]; then
    echo "Error: --output-dir must not traverse symlinks: $path_component" >&2
    exit 1
  fi
  path_component="$(dirname "$path_component")"
done

if [[ -e "$OUTPUT_DIR" ]]; then
  if [[ ! -d "$OUTPUT_DIR" ]]; then
    echo "Error: --output-dir exists but is not a directory: $OUTPUT_DIR" >&2
    exit 1
  fi
  if [[ -n "$(find "$OUTPUT_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    echo "Error: --output-dir must be empty: $OUTPUT_DIR" >&2
    exit 1
  fi
fi

# 下载 OpenAPI Generator CLI (如果不存在或 SHA-256 不匹配)
download_generator() {
  mkdir -p "$TOOLS_DIR"
  local jar_path="$TOOLS_DIR/$OPENAPI_GENERATOR_JAR"
  local download_url="https://repo1.maven.org/maven2/org/openapitools/openapi-generator-cli/${OPENAPI_GENERATOR_VERSION}/${OPENAPI_GENERATOR_JAR}"
  
  if [[ -f "$jar_path" ]]; then
    local actual_sha256
    actual_sha256=$(sha256sum "$jar_path" | cut -d' ' -f1)
    if [[ "$actual_sha256" == "$OPENAPI_GENERATOR_SHA256" ]]; then
      echo "OpenAPI Generator CLI already downloaded and verified"
      return 0
    else
      echo "SHA-256 mismatch, re-downloading..."
      rm -f "$jar_path"
    fi
  fi
  
  echo "Downloading OpenAPI Generator CLI ${OPENAPI_GENERATOR_VERSION}..."
  # 尝试 curl (支持代理)
  if ! curl -fsSL -o "$jar_path" "$download_url" 2>/dev/null; then
    echo "curl failed, trying wget..."
    wget -q -O "$jar_path" "$download_url"
  fi
  
  local actual_sha256
  actual_sha256=$(sha256sum "$jar_path" | cut -d' ' -f1)
  if [[ "$actual_sha256" != "$OPENAPI_GENERATOR_SHA256" ]]; then
    echo "Error: SHA-256 verification failed!" >&2
    echo "Expected: $OPENAPI_GENERATOR_SHA256" >&2
    echo "Actual:   $actual_sha256" >&2
    rm -f "$jar_path"
    exit 1
  fi
  
  echo "SHA-256 verification passed"
}

# 生成模型
generate_models() {
  local jar_path="$TOOLS_DIR/$OPENAPI_GENERATOR_JAR"
  local openapi_path="$PROJECT_ROOT/contracts/v1/generated/openapi-with-schemas.yaml"
  
  # 检查增强版 OpenAPI spec 是否存在
  if [[ ! -f "$openapi_path" ]]; then
    echo "Error: Enhanced OpenAPI spec not found: $openapi_path" >&2
    echo "Please run 'pnpm contract:generate' first to generate openapi-with-schemas.yaml" >&2
    exit 1
  fi
  
  # preflight 已验证该目录为空且位于受控根；这里只创建新的 staging directory。
  mkdir -p "$OUTPUT_DIR"
  
  echo "Generating Kotlin models from $openapi_path..."
  
  # 运行 OpenAPI Generator
  java -jar "$jar_path" generate \
    -i "$openapi_path" \
    -g kotlin \
    -o "$OUTPUT_DIR" \
    --package-name "io.yggdrasil.labs.mealmate.lite.contract.generated" \
    --additional-properties=serializationLibrary=kotlinx_serialization \
    --additional-properties=generateOneOfAnyOfWrappers=true \
    --additional-properties=dateLibrary=java8 \
    --additional-properties=enumPropertyNaming=original \
    --global-property=models \
    --global-property=supportingFiles=false \
    --generate-alias-as-model
  
  echo "Generation complete"
}

# 后处理生成的文件
# 修复 OpenAPI Generator 的已知问题:
# 1. 顶层 dangling KDoc -> 移除 (ktlint 规则 standard:kdoc)
# 2. kotlin.Any? 用于 string const 字段；boolean const 枚举降为 Boolean
# 3. 复制由契约编译器生成的协议目录
postprocess_models() {
  local models_dir="$OUTPUT_DIR/src/main/kotlin/io/yggdrasil/labs/mealmate/lite/contract/generated/models"
  local protocol_catalog="$PROJECT_ROOT/contracts/v1/generated/ProtocolCatalog.kt"
  local protocol_catalog_output="$OUTPUT_DIR/src/main/kotlin/io/yggdrasil/labs/mealmate/lite/contract/generated/ProtocolCatalog.kt"
  local current_plan_template="$SCRIPT_DIR/templates/CurrentWeeklyPlanResponse.kt"
  
  if [[ ! -d "$models_dir" ]]; then
    echo "Warning: Models directory not found: $models_dir" >&2
    return
  fi
  
  echo "Post-processing generated models..."
  
  # 1. 移除顶层 dangling KDoc (OpenAPI Generator 生成的文件头注释)
  # 这些注释在 @file:Suppress 之前，违反 ktlint 的 standard:kdoc 规则
  find "$models_dir" -name "*.kt" -exec perl -i -0pe \
    's|^/\*\*\n \*\n \* Please note:.*?Do not edit this file manually\.\n \*\n \*/\n+||s' {} \;
  
  # 2. 替换 @Contextual kotlin.Any? -> String (用于 string const 字段)
  # 这些字段是 JSON const，如 "op": "clear" 或 "resource": "recipe"。
  find "$models_dir" -name "*.kt" -exec sed -i \
    's/@Contextual @SerialName(value = \("[^"]*"\))\n    val \([a-zA-Z]*\): kotlin\.Any?/@SerialName(value = \1)\n    val \2: kotlin.String/g' {} \;
  
  # 使用 perl 处理多行替换
  find "$models_dir" -name "*.kt" -exec perl -i -0pe \
    's/\@Contextual \@SerialName\(value = ("[^"]*")\)\s*\n\s*val ([a-zA-Z]+): kotlin\.Any\?/\@SerialName(value = \1)\n    val \2: kotlin.String/g' {} \;

  # OpenAPI Generator 7.22 emits a nested enum for `{ type: boolean, const: ... }`,
  # but serializes its enum entry from a String literal even though the enum value is
  # Boolean. Keep the public model property as Boolean, correct the enum literal, and
  # attach a strict Boolean const serializer. This preserves source-schema const
  # semantics on both decoding and encoding without an allowlist of property names.
  while IFS= read -r -d '' model_file; do
    perl -i -0pe '
      my %boolean_enums;
      while (/enum class (\w+)\(val value: kotlin\.Boolean\) \{\s*\n\s*\@SerialName\(value = "(true|false)"\)/g) {
        $boolean_enums{$1} = $2;
      }
      for my $enum (keys %boolean_enums) {
        my $serializer = $boolean_enums{$enum} eq "true"
          ? "io.yggdrasil.labs.mealmate.lite.contract.BooleanConstTrueSerializer"
          : "io.yggdrasil.labs.mealmate.lite.contract.BooleanConstFalseSerializer";
        s/(\n(\s*)\@SerialName\(value = "[^"]+"\))(\n\2val \w+: )[A-Za-z0-9_]+\.\Q$enum\E(?=[,\n])/$1\n$2\@Serializable(with = $serializer\::class)$3kotlin.Boolean/g;
        s/(enum class \Q$enum\E\(val value: kotlin\.Boolean\) \{\s*\n\s*\@SerialName\(value = "true"\) `true`\()"true"/$1true/s;
        s/(enum class \Q$enum\E\(val value: kotlin\.Boolean\) \{\s*\n\s*\@SerialName\(value = "false"\) `false`\()"false"/$1false/s;
      }
    ' "$model_file"
  done < <(find "$models_dir" -name "*.kt" -print0)
  
  # 3. URI 保留为 java.net.URI，由 ContractJson 中注册的严格 contextual
  # serializer 处理；不得降级为 String，否则会丢失 URI 边界校验。

  # 4. OpenAPI Generator 7.22 会把 oneOf [WeeklyPlanView, null] 误投影成必填对象。
  # 这里的已审计模板保留 source schema 的 nullable union，且与每次 fresh generation
  # 一起复制，因此 freshness gate 仍是字节确定的。
  if [[ ! -f "$current_plan_template" ]]; then
    echo "Error: CurrentWeeklyPlanResponse template not found: $current_plan_template" >&2
    exit 1
  fi
  cp "$current_plan_template" "$models_dir/CurrentWeeklyPlanResponse.kt"

  if [[ ! -f "$protocol_catalog" ]]; then
    echo "Error: Generated protocol catalog not found: $protocol_catalog" >&2
    echo "Please run 'pnpm --dir server contract:generate' first" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$protocol_catalog_output")"
  cp "$protocol_catalog" "$protocol_catalog_output"

  # 5. 生成物本身是 canonical output，统一为 UTF-8/LF、无行尾空白且只保留一个
  # EOF 换行。不要交给 KtLint 格式化，否则 DTO 的字节会与独立 checker 的输出漂移。
  find "$OUTPUT_DIR/src/main/kotlin/io/yggdrasil/labs/mealmate/lite/contract/generated" \
    -type f -name "*.kt" -exec perl -i -0pe \
    's/\r\n?/\n/g; s/[ \t]+(?=\n)//g; s/\n*\z/\n/' {} \;
  
  echo "Post-processing complete (canonical generated output)"
}

# 主流程
main() {
  download_generator
  generate_models
  postprocess_models
}

main
