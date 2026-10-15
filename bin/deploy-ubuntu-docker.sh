#!/usr/bin/env bash
set -Eeuo pipefail
trap 'printf "\n部署未完成，请检查上方报错（第 %s 行）。\n" "$LINENO" >&2' ERR

CONTAINER="${NEW_API_CONTAINER:-new-api-usage-test}"
PORT="${NEW_API_PORT:-3001}"
INSTALL_DIR="${NEW_API_INSTALL_DIR:-$HOME/new-api-usage-test}"
REPO="cicioln/new-api"
COMMIT="${1:-__BUILD_COMMIT__}"

die() { printf '错误：%s\n' "$*" >&2; exit 1; }
[[ "$(uname -s)" == "Linux" ]] || die "请在 Ubuntu 服务器上执行。"
[[ "$COMMIT" =~ ^[0-9a-f]{40}$ ]] || die "请使用 Actions 发布的部署脚本，或传入完整构建提交号。"
[[ "$PORT" =~ ^[0-9]{1,5}$ ]] || die "端口必须为 1 到 65535。"
PORT=$((10#$PORT))
(( PORT >= 1 && PORT <= 65535 )) || die "端口必须为 1 到 65535。"
command -v docker >/dev/null || die "未找到 Docker，请在已有 Docker 的 Ubuntu 上执行。"

DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then
  if (( EUID != 0 )) && command -v sudo >/dev/null; then
    sudo -v
    DOCKER=(sudo docker)
  fi
  "${DOCKER[@]}" info >/dev/null 2>&1 || die "无法连接 Docker，请检查服务状态或权限。"
fi
if "${DOCKER[@]}" container inspect "$CONTAINER" >/dev/null 2>&1; then
  die "容器 $CONTAINER 已存在；如需另建实例，请设置 NEW_API_CONTAINER、NEW_API_PORT 和 NEW_API_INSTALL_DIR。"
fi
if command -v ss >/dev/null && [[ -n "$(ss -H -ltn "( sport = :$PORT )")" ]]; then
  die "端口 $PORT 已被占用，请设置 NEW_API_PORT。"
fi
case "$("${DOCKER[@]}" info --format '{{.Architecture}}')" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) die "仅支持 amd64 或 arm64 的 Linux Docker。" ;;
esac

if ! command -v curl >/dev/null || ! command -v openssl >/dev/null; then
  APT=(apt-get)
  if (( EUID != 0 )); then
    command -v sudo >/dev/null || die "请先安装 curl 和 openssl，或使用有 sudo 权限的账号。"
    APT=(sudo apt-get)
  fi
  "${APT[@]}" update
  "${APT[@]}" install -y curl openssl ca-certificates
fi

umask 077
mkdir -p "$INSTALL_DIR"
INSTALL_DIR="$(cd "$INSTALL_DIR" && pwd -P)"
DOWNLOAD_DIR="$INSTALL_DIR/downloads/$COMMIT"
DATA_DIR="$INSTALL_DIR/data"
ENV_FILE="$INSTALL_DIR/new-api.env"
ARCHIVE="new-api-docker-ubuntu-$ARCH.tar.gz"
RELEASE_URL="https://github.com/$REPO/releases/download/usage-reporting-docker-$COMMIT"
IMAGE="new-api:usage-reporting-$COMMIT"
mkdir -p "$DOWNLOAD_DIR"

printf '\n下载 Actions 已构建的 Docker 镜像（%s）……\n' "$ARCH"
curl -fL --retry 3 --connect-timeout 20 "$RELEASE_URL/$ARCHIVE.sha256" -o "$DOWNLOAD_DIR/$ARCHIVE.sha256"
curl -fL --retry 3 --connect-timeout 20 "$RELEASE_URL/$ARCHIVE" -o "$DOWNLOAD_DIR/$ARCHIVE.part"
mv -- "$DOWNLOAD_DIR/$ARCHIVE.part" "$DOWNLOAD_DIR/$ARCHIVE"
(cd "$DOWNLOAD_DIR" && sha256sum --check "$ARCHIVE.sha256")
"${DOCKER[@]}" load --input "$DOWNLOAD_DIR/$ARCHIVE"
[[ "$("${DOCKER[@]}" image inspect -f '{{.Architecture}}' "$IMAGE")" == "$ARCH" ]] || die "镜像架构与 Docker 主机不符。"

mkdir -p "$DATA_DIR"
if [[ ! -e "$ENV_FILE" ]]; then
  session_key="$(openssl rand -hex 32)"
  crypto_key="$(openssl rand -hex 32)"
  printf 'SESSION_SECRET=%s\nCRYPTO_SECRET=%s\n' "$session_key" "$crypto_key" > "$ENV_FILE"
  unset session_key crypto_key
fi
chmod 600 "$ENV_FILE"
"${DOCKER[@]}" run -d --pull never --name "$CONTAINER" --restart unless-stopped \
  -p "$PORT:3000" --env-file "$ENV_FILE" \
  -e TZ=Asia/Shanghai -e SQLITE_PATH=/data/new-api.db \
  -e SQL_DSN= -e LOG_SQL_DSN= -e REDIS_CONN_STRING= \
  --mount "type=bind,src=$DATA_DIR,dst=/data" "$IMAGE"

printf '\n正在等待新服务启动……\n'
for ((attempt = 1; attempt <= 60; attempt++)); do
  if "${DOCKER[@]}" exec "$CONTAINER" wget -q -T 3 -O /dev/null http://127.0.0.1:3000/api/status; then
    printf '\n部署完成！\n访问地址：http://服务器IP:%s\nAPI 地址：http://服务器IP:%s/v1\n容器：%s\n数据：%s\n\n首次打开网页后，请完成新实例初始化并配置渠道。\n' \
      "$PORT" "$PORT" "$CONTAINER" "$DATA_DIR"
    exit 0
  fi
  if [[ "$("${DOCKER[@]}" container inspect -f '{{.State.Running}}' "$CONTAINER")" != "true" ]]; then
    "${DOCKER[@]}" logs --tail 80 "$CONTAINER" || true
    die "新容器已停止，请检查上方日志。"
  fi
  sleep 2
done
"${DOCKER[@]}" logs --tail 80 "$CONTAINER" || true
die "新服务尚未就绪，容器和数据均已保留，请查看日志。"
