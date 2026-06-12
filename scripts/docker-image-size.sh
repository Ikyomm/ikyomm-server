#!/usr/bin/env bash
set -euo pipefail

SERVICES=(gateway auth kernel)
BUILD_FIRST=false
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/docker/docker-compose.yml"
ENV_FILE="${REPO_ROOT}/env/.env"
PROJECT_NAME="ikyomm"

print_usage() {
  cat <<'USAGE'
Usage:
  scripts/docker-image-size.sh [--build] [all|gateway|auth|kernel ...]

Examples:
  pnpm docker:size
  pnpm docker:size -- all
  pnpm docker:size -- gateway auth
  pnpm docker:size:build -- kernel
USAGE
}

contains_service() {
  local needle="$1"
  for svc in "${SERVICES[@]}"; do
    if [[ "$svc" == "$needle" ]]; then
      return 0
    fi
  done
  return 1
}

compose() {
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

compose_image_ref_for_service() {
  local svc="$1"
  local image_ref=""
  image_ref="$(compose config --images 2>/dev/null | awk -v service="$svc" 'NR == 1 { next } { print }' | grep -E "(^|/)${PROJECT_NAME}-${svc}(:|$)" | head -n 1 || true)"
  if [[ -z "$image_ref" ]]; then
    image_ref="${PROJECT_NAME}-${svc}"
  fi
  echo "$image_ref"
}

find_image_ref_for_service() {
  local svc="$1"
  local expected_repo
  local ref=""

  expected_repo="$(compose_image_ref_for_service "$svc")"
  expected_repo="${expected_repo%:latest}"

  if docker image inspect "${expected_repo}:latest" >/dev/null 2>&1; then
    echo "${expected_repo}:latest"
    return 0
  fi

  ref="$({
    docker image ls --format '{{.Repository}}:{{.Tag}}' \
      | awk -v repo="${expected_repo}" -F: '$1 == repo && $2 != "<none>" { print $0; exit }'
  } || true)"
  if [[ -n "$ref" ]]; then
    echo "$ref"
    return 0
  fi

  ref="$({
    docker image ls --format '{{.Repository}}:{{.Tag}}' \
      | awk -v suffix="-${svc}" -F: 'index($1, suffix) > 0 && $2 != "<none>" { print $0; exit }'
  } || true)"
  if [[ -n "$ref" ]]; then
    echo "$ref"
    return 0
  fi

  return 1
}

to_human() {
  local bytes="$1"
  awk -v b="$bytes" 'BEGIN {
    split("B KB MB GB TB", u, " ");
    i=1;
    while (b>=1024 && i<5) { b/=1024; i++ }
    printf("%.2f %s", b, u[i]);
  }'
}

args=()
for arg in "$@"; do
  if [[ "$arg" == "--help" || "$arg" == "-h" ]]; then
    print_usage
    exit 0
  elif [[ "$arg" == "--build" ]]; then
    BUILD_FIRST=true
  else
    args+=("$arg")
  fi
done

if [[ "${#args[@]}" -eq 0 ]]; then
  selected_services=("${SERVICES[@]}")
elif [[ "${#args[@]}" -eq 1 && "${args[0]}" == "all" ]]; then
  selected_services=("${SERVICES[@]}")
else
  selected_services=()
  for svc in "${args[@]}"; do
    if ! contains_service "$svc"; then
      echo "Unknown service: $svc" >&2
      print_usage >&2
      exit 1
    fi
    selected_services+=("$svc")
  done
fi

if [[ "$BUILD_FIRST" == "true" ]]; then
  compose build "${selected_services[@]}"
fi

printf "%-10s %-40s %-12s\n" "SERVICE" "IMAGE" "SIZE"
printf "%-10s %-40s %-12s\n" "--------" "----------------------------------------" "------------"

for svc in "${selected_services[@]}"; do
  image_ref="$(find_image_ref_for_service "$svc" || true)"
  if [[ -z "$image_ref" ]]; then
    printf "%-10s %-40s %-12s\n" "$svc" "not-built" "-"
    continue
  fi

  image_size="$(docker image inspect "$image_ref" --format '{{.Size}}')"
  printf "%-10s %-40s %-12s\n" "$svc" "$image_ref" "$(to_human "$image_size")"
done
