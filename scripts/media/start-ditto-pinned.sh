#!/usr/bin/env bash
set -euo pipefail
: "${DITTO_VERSION:=3.9.7}"
: "${DITTO_ROOT:=${HOME}/.cache/dinullah/ditto-${DITTO_VERSION}}"
: "${DITTO_EXPECTED_COMMIT_PREFIX:=0d31478}"
mkdir -p "${DITTO_ROOT}"
if [[ ! -d "${DITTO_ROOT}/.git" ]]; then
  git clone --depth 1 --branch "${DITTO_VERSION}" https://github.com/eclipse-ditto/ditto.git "${DITTO_ROOT}"
fi
git -C "${DITTO_ROOT}" fetch --tags --force origin
git -C "${DITTO_ROOT}" checkout --detach "${DITTO_VERSION}"
actual="$(git -C "${DITTO_ROOT}" rev-parse HEAD)"
case "$actual" in
  "${DITTO_EXPECTED_COMMIT_PREFIX}"*) echo "[DITTO PIN OK] $actual" ;;
  *) echo "[DITTO PIN MISMATCH] expected prefix ${DITTO_EXPECTED_COMMIT_PREFIX}, got $actual" >&2; exit 1 ;;
esac
cd "${DITTO_ROOT}/deployment/docker"
docker compose pull
docker compose up -d
docker compose ps
