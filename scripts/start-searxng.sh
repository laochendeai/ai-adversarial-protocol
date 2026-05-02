#!/bin/bash
# Start the AAP SearXNG container.
# Run from WSL2 Ubuntu: bash scripts/start-searxng.sh

set -e

PORT="${1:-28080}"
CFG_DIR="${HOME}/.searxng-config"

mkdir -p "${CFG_DIR}"

if [[ ! -f "${CFG_DIR}/settings.yml" ]]; then
  cat > "${CFG_DIR}/settings.yml" <<'YAML'
use_default_settings: true
server:
  bind_address: "0.0.0.0"
  port: 8080
  secret_key: "aap-searxng-local-key-change-in-prod"
  limiter: false
  image_proxy: false
search:
  formats:
    - html
    - json
  safe_search: 0
  autocomplete: ""
  default_lang: ""
ui:
  static_use_hash: true
YAML
  echo "wrote ${CFG_DIR}/settings.yml"
fi

# Pull only if missing (registry mirror in /etc/docker/daemon.json takes care of speed).
if ! docker image inspect searxng/searxng:latest >/dev/null 2>&1; then
  docker pull searxng/searxng:latest
fi

# Recreate the container.
docker rm -f aap-searxng >/dev/null 2>&1 || true
docker run -d --name aap-searxng --restart unless-stopped \
  -p "${PORT}:8080" \
  -v "${CFG_DIR}:/etc/searxng" \
  searxng/searxng:latest >/dev/null

echo "✓ SearXNG up on http://127.0.0.1:${PORT}"
echo "  test: curl 'http://127.0.0.1:${PORT}/search?q=hello&format=json&engines=bing'"
