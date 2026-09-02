#!/usr/bin/env bash

set -euo pipefail

DEPLOY_DIR="/data/manto"
OPENRESTY_DIR="/opt/1panel/apps/openresty/openresty"
SITE_SSL_DIR="${OPENRESTY_DIR}/www/sites/manto.xin/ssl"
LETSENCRYPT_DIR="${DEPLOY_DIR}/letsencrypt"

docker run --rm \
  -v "${LETSENCRYPT_DIR}:/etc/letsencrypt" \
  -v "${OPENRESTY_DIR}/root:/var/www/acme" \
  certbot/certbot:latest renew --webroot -w /var/www/acme --quiet

install -m 644 "${LETSENCRYPT_DIR}/live/manto.xin/fullchain.pem" "${SITE_SSL_DIR}/fullchain.pem"
install -m 600 "${LETSENCRYPT_DIR}/live/manto.xin/privkey.pem" "${SITE_SSL_DIR}/privkey.pem"

docker compose --env-file "${OPENRESTY_DIR}/.env" -f "${OPENRESTY_DIR}/docker-compose.yml" exec -T openresty nginx -t
docker compose --env-file "${OPENRESTY_DIR}/.env" -f "${OPENRESTY_DIR}/docker-compose.yml" exec -T openresty nginx -s reload

