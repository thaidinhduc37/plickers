#!/bin/bash
set -euo pipefail

EMAIL="doi4.pv01@dala.bca"
CA_SERVER="https://ca.o.io/acme/acme/directory"
CA_ROOT_CERT_URL="http://ca.o.io/root_ca.crt"

# auto | webroot | standalone
ISSUE_MODE="auto"

# ================== CHECK CERTBOT ==================
if ! command -v certbot >/dev/null 2>&1; then
    echo "[INFO] Certbot chưa được cài. Đang cài đặt..."
    apt update
    apt install -y certbot
else
    echo "[INFO] Certbot đã được cài."
fi

# ================== INPUT DOMAIN ==================
read -rp "Nhập domain cần tạo chứng chỉ: " DOMAIN
if [[ -z "$DOMAIN" ]]; then
    echo "[ERROR] Domain không được để trống!"
    exit 1
fi

echo "[INFO] Domain: $DOMAIN"
echo "[INFO] Issue mode: $ISSUE_MODE"

# ================== CHECK ACME ==================
echo "[INFO] Checking reachability of ACME directory..."
if ! curl -fsSk --max-time 10 "$CA_SERVER" -o /tmp/_acme_dir.json; then
  echo "[ERROR] Cannot fetch ACME directory from $CA_SERVER"
  exit 3
fi

# ================== INSTALL CA ROOT ==================
if [[ -n "$CA_ROOT_CERT_URL" ]]; then
  mkdir -p /usr/local/share/ca-certificates/custom
  tmpcrt="/tmp/ca_root_$$.crt"
  if curl -fsS --max-time 10 -o "$tmpcrt" "$CA_ROOT_CERT_URL"; then
    dest="/usr/local/share/ca-certificates/custom/root_ca.crt"
    if ! cmp -s "$tmpcrt" "$dest" 2>/dev/null; then
      mv -f "$tmpcrt" "$dest"
      update-ca-certificates || true
      echo "[OK] CA root installed/updated"
    else
      rm -f "$tmpcrt"
    fi
  fi
fi

# ================== WEBROOT DETECTION ==================
candidates=(
  "/var/www/$DOMAIN/html"
  "/var/www/$DOMAIN/public_html"
  "/var/www/$DOMAIN"
  "/var/www/html"
  "/usr/share/nginx/html"
  "/var/www"
)

detect_webroot() {
  for r in "${candidates[@]}"; do
    mkdir -p "$r/.well-known/acme-challenge" 2>/dev/null || continue
    testfile="$r/.well-known/acme-challenge/probe_$RANDOM"
    echo "probe" > "$testfile" || continue
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
      "http://$DOMAIN/.well-known/acme-challenge/$(basename "$testfile")" || true)
    rm -f "$testfile"
    [[ "$code" == "200" ]] && echo "$r" && return 0
  done
  return 1
}

WEBROOT=""

if [[ "$ISSUE_MODE" != "standalone" ]]; then
  if WEBROOT=$(detect_webroot); then
    echo "[OK] Webroot detected: $WEBROOT"
  elif [[ "$ISSUE_MODE" == "webroot" ]]; then
    read -rp "Webroot path: " WEBROOT
    [[ -z "$WEBROOT" ]] && echo "[ERROR] No webroot provided" && exit 4
  fi
fi

# ================== ISSUE CERT ==================
if [[ -n "$WEBROOT" ]]; then
  echo "[INFO] Using webroot mode"
  mkdir -p "$WEBROOT/.well-known/acme-challenge"
  chmod -R 755 "$WEBROOT/.well-known"

  certbot certonly \
    --webroot -w "$WEBROOT" \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    --server "$CA_SERVER"

else
  echo "[INFO] Using standalone mode (port 80 required)"

  # check port 80
  if ss -lnt | grep -q ':80 '; then
    echo "[ERROR] Port 80 is in use. Cannot run standalone."
    exit 6
  fi

  certbot certonly \
    --standalone \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    --server "$CA_SERVER"
fi

echo "[SUCCESS] Certificate issued for $DOMAIN"
