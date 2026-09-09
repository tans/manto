#!/usr/bin/env bash
# Copyable release-job template: publish one version's release notes to Manto.
# Usage: MANTO_PRODUCT_NAME="My App" ./publish-changelog.sh v1.2.3 RELEASE_NOTES.md https://example.com/releases/v1.2.3

set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "usage: MANTO_PRODUCT_NAME=\"Product\" $0 <version> <release-notes-file> <release-url>" >&2
  exit 64
fi

version="$1"
release_notes="$2"
release_url="$3"
product_name="${MANTO_PRODUCT_NAME:-$(basename "$PWD")}"
release_date="${MANTO_RELEASE_DATE:-$(date -u +%F)}"
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

if [ ! -s "$release_notes" ]; then
  echo "error: release notes file is missing or empty: $release_notes" >&2
  exit 66
fi

content_file=$(mktemp "${TMPDIR:-/tmp}/manto-release.XXXXXX")
trap 'rm -f "$content_file"' EXIT
{
  printf '%s 于 %s 发布 %s。以下是本次版本的事实变更与兼容性说明。\n\n' "$product_name" "$release_date" "$version"
  cat "$release_notes"
} > "$content_file"

external_id="${MANTO_EXTERNAL_ID:-${product_name}:release:${version}}"
title="${MANTO_RELEASE_TITLE:-${product_name} ${version} 发布}"

if [ "${MANTO_DRY_RUN:-0}" = "1" ]; then
  printf 'external_id=%s\ntitle=%s\nurl=%s\n' "$external_id" "$title" "$release_url"
  cat "$content_file"
  exit 0
fi

python3 "$script_dir/manto.py" publish \
  --external-id "$external_id" \
  --title "$title" \
  --content-file "$content_file" \
  --url "$release_url"
