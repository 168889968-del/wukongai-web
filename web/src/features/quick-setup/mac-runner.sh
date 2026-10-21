# macOS desktop setup and restore. No npm, Python or command-line client required.
set -euo pipefail
umask 077
stage='检查运行环境'
scratch=''
lock=''
changed=0
cleanup() {
  result=$?
  trap - EXIT
  if [ "$result" -ne 0 ]; then
    printf '\n执行失败：%s。没有完成配置。\n' "$stage" >&2
    if [ "$changed" -eq 1 ] && [ "$client" = codex ]; then
      restore_codex_snapshot || printf '自动回滚失败，请保留备份目录：%s\n' "$backup" >&2
    fi
  fi
  if [ -n "$scratch" ]; then
    if [ -d "$scratch/mount" ]; then hdiutil detach "$scratch/mount" >/dev/null 2>&1 || true; fi
    rm -rf -- "$scratch"
  fi
  [ -z "$lock" ] || rmdir -- "$lock" 2>/dev/null || true
  exit "$result"
}
trap cleanup EXIT
die() { printf '%s\n' "$1" >&2; exit 1; }
[ "$(uname -s)" = Darwin ] || die '这是苹果电脑专用工具。Windows 请下载 BAT；Linux 请使用对应客户端配置。'
[ "$(id -u)" -ne 0 ] || die '请以当前登录用户运行，不要用 sudo 运行整个脚本。需要管理员权限时工具会单独提示。'
major=$(sw_vers -productVersion | cut -d. -f1)
[ "$major" -ge 14 ] || die '此桌面接入工具需要 macOS 14 或更新版本。'
scratch=$(mktemp -d "${TMPDIR:-/tmp}/wukongai-mac.XXXXXX")
app_name=Codex
bundle=com.openai.codex
download='https://persistent.oaistatic.com/codex-app-prod/Codex.dmg'
if [ "$client" = claude ]; then
  app_name=Claude
  bundle=com.anthropic.claudefordesktop
  download='https://claude.ai/api/desktop/darwin/universal/dmg/latest/redirect'
fi
app="/Applications/$app_name.app"
[ ! -d "$HOME/Applications/$app_name.app" ] || app="$HOME/Applications/$app_name.app"
root="${CODEX_HOME:-$HOME/.codex}"
if [ "$client" = claude ]; then root="$HOME/Library/Application Support/Claude-3p"; fi
mkdir -p "$root"
backup="$root/.wukongai-mac-backup"
candidate_lock="$root/.wukongai-mac-lock"
mkdir "$candidate_lock" 2>/dev/null || die '已有一个配置工具正在运行，请等待它结束。'
lock="$candidate_lock"
archive="$root/wukongai-recovery-$(date +%Y%m%d-%H%M%S)-$$"
policy_dir="/Library/Managed Preferences/$(id -un)"
policy="$policy_dir/com.anthropic.claudefordesktop.plist"
snapshot_codex() {
  if [ ! -f "$backup/active" ]; then
    mkdir -p "$backup"
    for name in config.toml auth.json; do
      rm -f "$backup/$name.original" "$backup/$name.absent"
      if [ -f "$root/$name" ]; then cp -p "$root/$name" "$backup/$name.original"; else touch "$backup/$name.absent"; fi
    done
    touch "$backup/active"
    rm -f "$backup/restored"
  fi
}
restore_codex_snapshot() {
  # Validate the complete snapshot before changing either file.
  for name in config.toml auth.json; do
    [ -f "$backup/$name.original" ] || [ -f "$backup/$name.absent" ] || return 1
  done
  mkdir -p "$archive"
  for name in config.toml auth.json; do
    if [ -f "$root/$name" ]; then cp -p "$root/$name" "$archive/$name"; fi
    if [ -f "$backup/$name.original" ]; then
      cp "$backup/$name.original" "$root/$name.wukongai.tmp"
      chmod 600 "$root/$name.wukongai.tmp"
      mv "$root/$name.wukongai.tmp" "$root/$name"
    else
      rm -f "$root/$name"
    fi
  done
}
restore_legacy_codex() {
  # Old scripts overwrote .bak on repeated setup and never recorded absent files.
  # Keep every old file for recovery; never restore a backup still pointing here.
  mkdir -p "$archive"
  legacy_managed=0
  if [ -f "$root/config.toml" ] && grep -Eq 'wukongai|wukongai\.work' "$root/config.toml"; then legacy_managed=1; fi
  for name in config.toml auth.json; do
    [ ! -f "$root/$name" ] || cp -p "$root/$name" "$archive/$name"
    [ ! -f "$root/$name.wukongai.bak" ] || cp -p "$root/$name.wukongai.bak" "$archive/$name.legacy-backup"
  done
  previous="$root/config.toml.wukongai.bak"
  if [ -f "$previous" ] && ! grep -Eq 'wukongai|wukongai\.work' "$previous"; then
    cp "$previous" "$root/config.toml"
  elif [ -f "$root/config.toml" ] && grep -Eq 'wukongai|wukongai\.work' "$root/config.toml"; then
    # Remove only settings written by the previous generated config.
    awk '
      /^\[/ { section=1; skip=($0 ~ /^\[model_providers\.wukongai(\]|\.)/) }
      skip { next }
      /^[[:space:]]*model_provider[[:space:]]*=[[:space:]]*"wukongai"/ { next }
      !section && /^[[:space:]]*model[[:space:]]*=/ { next }
      { print }
    ' "$root/config.toml" > "$root/config.toml.wukongai.tmp"
    mv "$root/config.toml.wukongai.tmp" "$root/config.toml"
  fi
  previous="$root/auth.json.wukongai.bak"
  if [ -f "$previous" ] && /usr/bin/plutil -extract tokens raw -o /dev/null "$previous" 2>/dev/null; then
    cp "$previous" "$root/auth.json"
  elif [ "$legacy_managed" -eq 1 ] && [ -f "$root/auth.json" ] && /usr/bin/plutil -extract OPENAI_API_KEY raw -o /dev/null "$root/auth.json" 2>/dev/null; then
    # The old tool stored only an API key here. Preserve it in the recovery folder.
    # Official ChatGPT OAuth credentials are never removed.
    if ! /usr/bin/plutil -extract tokens raw -o /dev/null "$root/auth.json" 2>/dev/null; then mv "$root/auth.json" "$archive/auth-current.json"; fi
  fi
}
if pgrep -x "$app_name" >/dev/null; then
  printf '请先保存工作，并用 Command+Q 完全退出 %s，再按回车继续。\n' "$app_name"
  read -r _
  pgrep -x "$app_name" >/dev/null && die '客户端仍在运行，未修改配置。'
fi
if [ "$mode" = restore ]; then
  stage='恢复原配置'
  if [ "$client" = codex ]; then
    if [ -f "$backup/active" ]; then
      restore_codex_snapshot
      rm -f "$backup/active"
      touch "$backup/restored"
    elif [ ! -f "$backup/restored" ]; then
      restore_legacy_codex
      mkdir -p "$backup"
      touch "$backup/restored"
    fi
  else
    if [ -f "$backup/active" ]; then
      if [ -f "$policy" ]; then
        cmp -s "$policy" "$backup/applied.plist" || die 'Claude 策略已被其他程序修改，请联系管理员处理；未覆盖现有策略。'
        sudo /bin/rm -f "$policy"
      fi
      rm -f "$backup/active"
      touch "$backup/restored"
    else
      printf '没有本工具的桌面配置备份，未修改 Claude 设置。\n'
    fi
  fi
  printf '已恢复。请重新打开 %s；原官方登录已失效时，需要重新登录官方账号。历史会话未删除。\n' "$app_name"
  if [ -d "$app" ]; then open "$app"; fi
  exit 0
fi
if [ "$mode" = setup ]; then
  stage='验证 API 密钥和模型'
  printf 'url = "%s/v1/models"\nheader = "Authorization: Bearer %s"\n' "$gateway" "${api_key//\"/\\\"}" > "$scratch/request.conf"
  curl --fail --silent --show-error --connect-timeout 15 --max-time 45 --config "$scratch/request.conf" --output "$scratch/models.json" || die '无法验证密钥。请检查网络、代理和 API 权限；尚未修改配置。'
  found=0
  index=0
  while candidate=$(/usr/bin/plutil -extract "data.$index.id" raw -o - "$scratch/models.json" 2>/dev/null); do
    if [ "$candidate" = "$selected_model" ]; then found=1; break; fi
    index=$((index+1))
  done
  [ "$found" -eq 1 ] || die '当前 API 密钥没有所选模型权限，请回到网站重新选择。尚未修改配置。'
fi
if [ ! -d "$app" ]; then
  stage='下载安装官方桌面应用'
  printf '正在下载 %s 官方桌面应用，请保持窗口打开。\n' "$app_name"
  curl --fail --location --show-error --connect-timeout 20 --max-time 600 "$download" --output "$scratch/installer.dmg"
  mkdir "$scratch/mount"
  hdiutil attach -nobrowse -readonly -mountpoint "$scratch/mount" "$scratch/installer.dmg" >/dev/null
  source_app="$scratch/mount/$app_name.app"
  if [ ! -d "$source_app" ]; then hdiutil detach "$scratch/mount" >/dev/null; die '安装包未包含预期的桌面应用。'; fi
  stage='验证应用签名'
  actual=$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$source_app/Contents/Info.plist")
  [ "$actual" = "$bundle" ] || die '安装包应用标识不匹配，未安装。'
  codesign --verify --deep --strict "$source_app"
  spctl --assess --type execute "$source_app"
  mkdir -p "$HOME/Applications"
  app="$HOME/Applications/$app_name.app"
  ditto "$source_app" "$app"
  hdiutil detach "$scratch/mount" >/dev/null
fi
if [ "$mode" = install ]; then
  printf '桌面应用已安装。请回到网站选择 API 密钥和模型，运行接入工具。\n'
  exit 0
fi
stage='保存桌面接入配置'
if [ "$client" = codex ]; then
  if [ ! -f "$backup/active" ] && [ -f "$root/config.toml" ] && grep -Eq 'model_provider[[:space:]]*=[[:space:]]*"wukongai"' "$root/config.toml"; then restore_legacy_codex; fi
  snapshot_codex
  changed=1
  printf '%s' "$codex_config" > "$root/config.toml.wukongai.tmp"
  printf '%s\n' "$codex_auth" > "$root/auth.json.wukongai.tmp"
  mv "$root/config.toml.wukongai.tmp" "$root/config.toml"
  mv "$root/auth.json.wukongai.tmp" "$root/auth.json"
else
  machine='/Library/Managed Preferences/com.anthropic.claudefordesktop.plist'
  [ ! -f "$machine" ] || die '此电脑已有组织管理的 Claude 配置，请联系管理员，未覆盖组织策略。'
  if [ -f "$policy" ]; then
    [ -f "$backup/active" ] && cmp -s "$policy" "$backup/applied.plist" || die '此账户已有其他 Claude 策略，请联系管理员，未覆盖。'
  fi
  mkdir -p "$backup"
  printf '%s' "$claude_policy" > "$scratch/claude.plist"
  /usr/bin/plutil -lint "$scratch/claude.plist" >/dev/null
  printf '需要管理员授权，为当前账户写入 Claude 桌面接入设置。\n'
  sudo -v
  if [ ! -d "$policy_dir" ]; then sudo /usr/bin/install -d -m 700 -o "$(id -u)" -g "$(id -g)" "$policy_dir"; fi
  # Snapshot the intended file before installation, so interrupted setup is recoverable.
  cp "$scratch/claude.plist" "$backup/applied.plist"
  touch "$backup/active"
  rm -f "$backup/restored"
  sudo /usr/bin/install -m 600 -o "$(id -u)" -g "$(id -g)" "$scratch/claude.plist" "$policy"
  cmp -s "$policy" "$backup/applied.plist" || die 'Claude 桌面策略写入校验失败。'
fi
printf '接入配置已写入，正在打开 %s。请发送一条消息验证；如果提示错误，请保留错误信息。\n' "$app_name"
open "$app"
