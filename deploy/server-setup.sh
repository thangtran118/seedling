#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 EC2 instance: Docker, swap (the Next.js build needs more than 2 GB),
# Vietnam time zone, and the app directory.
#   ssh ubuntu@<ip> 'sudo bash -s' < deploy/server-setup.sh
set -euo pipefail

APP_DIR=/opt/seedling
APP_USER="${SUDO_USER:-ubuntu}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Chạy bằng sudo: ssh ubuntu@<ip> 'sudo bash -s' < deploy/server-setup.sh" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl rsync unattended-upgrades

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker
usermod -aG docker "$APP_USER"

if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

timedatectl set-timezone Asia/Ho_Chi_Minh

mkdir -p "$APP_DIR/backups"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 700 "$APP_DIR/backups"

echo "Xong. Đăng xuất rồi SSH lại để nhóm docker có hiệu lực, sau đó tạo $APP_DIR/.env (xem DEPLOY.md)."
