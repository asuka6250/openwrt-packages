#!/bin/bash

# =======================================================
# OpenWrt Plugin Auto-Sync Script (Ultimate Bulletproof)
# =======================================================

TARGET_DIR=$(git rev-parse --show-toplevel)

if [ -z "$TARGET_DIR" ]; then
    echo "❌ Error: Not in a git repository!"
    exit 1
fi

STATE_DIR="$TARGET_DIR/.github/sync-state"
mkdir -p "$STATE_DIR"

# ---------------------------------------------------
# Initialize the whitelist
# ---------------------------------------------------
WHITELIST_FILE="$TARGET_DIR/.github/scripts/plugin_whitelist.txt"
USER_WHITELIST_FILE="$TARGET_DIR/.github/scripts/user_whitelist.txt" 

if [ ! -f "$WHITELIST_FILE" ]; then
    touch "$WHITELIST_FILE"
fi
if [ ! -f "$USER_WHITELIST_FILE" ]; then # 
    touch "$USER_WHITELIST_FILE"
fi

SUMMARY_FILE="$STATE_DIR/sync_summary.txt"
COMMIT_QUEUE="$STATE_DIR/commit_queue.txt"
> "$SUMMARY_FILE"
> "$COMMIT_QUEUE"
git config --local user.email "github-actions[bot]@users.noreply.github.com"
git config --local user.name "github-actions[bot]"

# ---------------------------------------------------
# 📦 Configuration 1: Full Repositories
# ---------------------------------------------------
declare -A FULL_REPOS
FULL_REPOS=(
    ["https://github.com/eamonxg/luci-app-aurora-config.git"]=""
    ["https://github.com/qimaoww/luci-app-lanspeed.git"]=""
    ["https://github.com/jerrykuku/luci-theme-argon.git"]=""
    ["https://github.com/jerrykuku/luci-app-argon-config.git"]=""
    ["https://github.com/eamonxg/luci-theme-aurora.git"]=""
    # ["https://github.com/Openwrt-Passwall/openwrt-passwall.git"]=""
    # ["https://github.com/Openwrt-Passwall/openwrt-passwall2.git"]=""
    # ["https://github.com/Openwrt-Passwall/openwrt-passwall-packages.git"]=""
    # ["https://github.com/nikkinikki-org/OpenWrt-nikki.git"]=""
    ["https://github.com/nikkinikki-org/OpenWrt-momo.git"]=""
    ["https://github.com/sbwml/luci-app-quickfile.git"]=""
    ["https://github.com/sbwml/feeds_packages_net_nginx.git"]=""
    ["https://github.com/vernesong/OpenClash.git"]=""
    ["https://github.com/immortalwrt/homeproxy.git"]=""
    ["https://github.com/sbwml/luci-app-mosdns.git"]="v5"
    ["https://github.com/KawaiiHachimi/luci-theme-tp.git"]=""
    ["https://github.com/kiddin9/luci-app-adguardhome.git"]=""
    ["https://github.com/sirpdboy/luci-theme-kucat.git"]=""
    ["https://github.com/sirpdboy/luci-app-kucat-config.git"]=""
    ["https://github.com/QiuSimons/vmlinux-btf.git"]=""
    # ["https://github.com/Tokisaki-Galaxy/luci-app-tailscale-community.git"]=""
    ["https://github.com/xianren78/luci-app-smartdns.git"]="" 
    ["https://github.com/eamonxg/luci-theme-shadcn.git"]=""
    # ["https://github.com/kenzok8/openwrt-daede.git"]=""
    ["https://github.com/kenzok8/openwrt-clashoo.git"]=""
)

# ---------------------------------------------------
# 📂 Configuration 2: Sparse Checkout 
# ---------------------------------------------------
SPARSE_REPOS=(
    "coolsnowwolf/luci|openwrt-25.12|themes/luci-theme-design"
    "immortalwrt/packages|openwrt-25.12|net/ua2f"
    "immortalwrt/immortalwrt|openwrt-25.12|package/emortal/cpufreq"
    "immortalwrt/luci|openwrt-25.12|applications/luci-app-ua2f applications/luci-app-arpbind applications/luci-app-cpufreq"
    "sbwml/openwrt_helloworld||luci-app-ssr-plus luci-app-dae luci-app-daed lua-neturl dns2tcp"
    "sbwml/openwrt_pkgs||bash-completion"
    "kiddin9/op-packages||lucky luci-app-lucky luci-theme-material3 smartdns"
    "Openwrt-Passwall/openwrt-passwall||luci-app-passwall"
    "Openwrt-Passwall/openwrt-passwall2||luci-app-passwall2"
    "Openwrt-Passwall/openwrt-passwall-packages||chinadns-ng dns2socks geoview hysteria ipt2socks microsocks naiveproxy shadow-tls shadowsocks-rust shadowsocksr-libev simple-obfs sing-box tcping v2ray-geodata v2ray-plugin xray-core xray-plugin"
    "kenzok8/openwrt-daede||dae daed luci-app-daede"
    "nikkinikki-org/OpenWrt-nikki||nikki mihomo-alpha mihomo-meta luci-app-nikki"
)

get_remote_hash_safe() {
    local repo=$1
    local branch=$2
    local res=""
    if [ -z "$branch" ]; then
        res=$(git ls-remote "$repo" HEAD 2>/dev/null | awk '{print $1}')
    else
        res=$(git ls-remote "$repo" "refs/heads/$branch" 2>/dev/null | awk '{print $1}')
    fi
    echo "$res"
}

# =======================================================
# Phase 0: Orphan Cleanup & Whitelist Sync
# =======================================================
echo "🧹 Phase 0: Scanning for orphaned or removed plugins..."
EXPECTED_FOLDERS=()

for repo in "${!FULL_REPOS[@]}"; do
    EXPECTED_FOLDERS+=($(basename "$repo" .git))
done

for entry in "${SPARSE_REPOS[@]}"; do
    entry=$(echo "$entry" | tr -d '\r\n')
    IFS='|' read -r repo branch sub_dirs <<< "$entry"
    for sub_dir in $sub_dirs; do
        EXPECTED_FOLDERS+=($(basename "$sub_dir"))
    done
done

if [ -f "$WHITELIST_FILE" ]; then
    for whitelisted_pkg in $(grep -v '^\s*#' "$WHITELIST_FILE" | grep -v '^\s*$'); do
        is_expected=false
        for expected in "${EXPECTED_FOLDERS[@]}"; do
            if [ "$whitelisted_pkg" == "$expected" ]; then
                is_expected=true
                break
            fi
        done
        
        if [ "$is_expected" == false ]; then
            echo "✂️  Config commented out! Auto-removing '$whitelisted_pkg' from whitelist.txt..."
            sed -i "/^${whitelisted_pkg}$/d" "$WHITELIST_FILE"
        fi
    done
fi

cd "$TARGET_DIR"
for folder in *; do
    if [ -d "$folder" ] && [[ ! "$folder" =~ ^\. ]] && [ "$folder" != ".github" ] && [ "$folder" != "scripts" ] && [ "$folder" != "packages" ]; then
        
        if grep -Fxq "$folder" "$USER_WHITELIST_FILE" 2>/dev/null; then
            echo "👑 Protected by USER whitelist: $folder (Skipping cleanup)"
            continue
        fi

        if grep -Fxq "$folder" "$WHITELIST_FILE" 2>/dev/null; then
            echo "🛡️  Protected by whitelist: $folder (Skipping cleanup)"
            continue
        fi

        is_orphaned=true
        for expected in "${EXPECTED_FOLDERS[@]}"; do
            if [ "$folder" == "$expected" ]; then
                is_orphaned=false
                break
            fi
        done
        
        if [ "$is_orphaned" == true ]; then
            echo "🗑️  Removing deprecated plugin: $folder"
            git rm -rf "$folder" >/dev/null 2>&1
            git commit -m "chore: remove deprecated plugin $folder" &>/dev/null || true
        fi
    fi
done

# =======================================================
# Phase 1: Sync Full Repositories
# =======================================================
echo ""
echo "---------------------------------------------------"
echo "📦 Phase 1: Syncing full repositories"
echo "---------------------------------------------------"

for repo in "${!FULL_REPOS[@]}"; do
    branch="${FULL_REPOS[$repo]}"
    folder_name=$(basename "$repo" .git)
    target_path="$TARGET_DIR/$folder_name"
    local_hash_file="$target_path/.upstream_commit"
    
    remote_hash=$(get_remote_hash_safe "$repo" "$branch" | tr -d '\r\n[:space:]')
    if [ -z "$remote_hash" ]; then
        echo "⚠️  WARNING: Upstream repo '$folder_name' inaccessible. Skipping..."
        
        if ! grep -Fxq "$folder_name" "$WHITELIST_FILE" 2>/dev/null; then
            echo "$folder_name" >> "$WHITELIST_FILE"
            echo "🛡️  Auto-added '$folder_name' to whitelist.txt"
        fi
        continue
    fi
    
    if grep -Fxq "$folder_name" "$WHITELIST_FILE" 2>/dev/null; then
        sed -i "/^${folder_name}$/d" "$WHITELIST_FILE"
        echo "♻️  Upstream recovered! Auto-removed '$folder_name' from whitelist.txt"
    fi
    
    local_hash=""
    [ -f "$local_hash_file" ] && local_hash=$(cat "$local_hash_file" | tr -d '\r\n[:space:]')
    
    if [ "$local_hash" = "$remote_hash" ]; then
        echo "✨ $folder_name is up-to-date."
        continue
    fi
    
    echo "📥 Update found! Cloning: $folder_name"
    rm -rf "$target_path"
    
    if [ -z "$branch" ]; then
        git clone --depth 1 "$repo" "$target_path" >/dev/null 2>&1
    else
        git clone --depth 1 -b "$branch" "$repo" "$target_path" >/dev/null 2>&1
    fi
    
    if [ $? -ne 0 ]; then
        echo "❌ Clone failed for $folder_name, skip."
        continue
    fi
    
    pushd "$target_path" >/dev/null
    commit_msg=$(git log -1 --pretty=format:"%s (%h)")
    popd >/dev/null
    
    PATCH_MARK=""
    [ -d "$TARGET_DIR/.github/patches/$folder_name" ] && PATCH_MARK=" [patched]"
    
    rm -rf "$target_path/.git"
    echo -n "$remote_hash" > "$local_hash_file"
    
    echo "$folder_name|$folder_name$PATCH_MARK: $commit_msg" >> "$COMMIT_QUEUE"
done

# =======================================================
# Phase 2: Sync Specific Subdirectories
# =======================================================
echo ""
echo "---------------------------------------------------"
echo "📂 Phase 2: Syncing specific subdirectories"
echo "---------------------------------------------------"

function process_sparse_repo() {
    local repo_path=$1
    local branch=$2
    local sub_dirs_str=$3

    local repo_url="https://github.com/${repo_path}.git"
    local tmp_dir=$(mktemp -d)
    local branch_args=()
    if [ -n "$branch" ]; then
        branch_args=("-b" "$branch")
    fi
    
    git clone --filter=blob:none --no-checkout "${branch_args[@]}" "$repo_url" "$tmp_dir" >/dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo "❌ Sparse clone metadata failed for $repo_path, skip."
        
        for sub_dir in $sub_dirs_str; do
            local target_name=$(basename "$sub_dir")
            if ! grep -Fxq "$target_name" "$WHITELIST_FILE" 2>/dev/null; then
                echo "$target_name" >> "$WHITELIST_FILE"
                echo "🛡️  Auto-added '$target_name' to whitelist.txt"
            fi
        done
        
        rm -rf "$tmp_dir"
        return
    fi

    pushd "$tmp_dir" >/dev/null
    
    local dirs_to_update=()
    declare -A dir_hashes
    
    for sub_dir in $sub_dirs_str; do
        sub_dir=$(echo "$sub_dir" | tr -d '\r\n[:space:]')
        [ -z "$sub_dir" ] && continue
        
        local target_name=$(basename "$sub_dir")
        local target_path="$TARGET_DIR/$target_name"
        local local_hash_file="$target_path/.upstream_commit"

        local remote_tree_hash=$(git ls-tree HEAD "$sub_dir" 2>/dev/null | awk '$2 == "tree" {print $3}' | tr -d '\r\n[:space:]')

        if [ -z "$remote_tree_hash" ]; then
            echo "⚠️  WARNING: Upstream dir '$sub_dir' missing or deleted. Skipping..."
            if ! grep -Fxq "$target_name" "$WHITELIST_FILE" 2>/dev/null; then
                echo "$target_name" >> "$WHITELIST_FILE"
                echo "🛡️  Auto-added '$target_name' to whitelist.txt"
            fi
            continue
        fi

        if grep -Fxq "$target_name" "$WHITELIST_FILE" 2>/dev/null; then
            sed -i "/^${target_name}$/d" "$WHITELIST_FILE"
            echo "♻️  Upstream dir recovered! Auto-removed '$target_name' from whitelist.txt"
        fi

        local local_hash=""
        [ -f "$local_hash_file" ] && local_hash=$(cat "$local_hash_file" | tr -d '\r\n[:space:]')

        if [ "$local_hash" = "$remote_tree_hash" ]; then
            echo "✨ $target_name is up-to-date."
            continue
        fi
        
        echo "🎯 Update found! Queuing for extraction: $target_name"
        dirs_to_update+=("$sub_dir")
        dir_hashes["$sub_dir"]="$remote_tree_hash"
    done
    
    if [ ${#dirs_to_update[@]} -eq 0 ]; then
        popd >/dev/null
        rm -rf "$tmp_dir"
        return
    fi
    
    git sparse-checkout set "${dirs_to_update[@]}" >/dev/null 2>&1
    git checkout >/dev/null 2>&1
    
    local repo_header_printed=false
    
    for sub_dir in "${dirs_to_update[@]}"; do
        local target_name=$(basename "$sub_dir")
        local target_path="$TARGET_DIR/$target_name"
        local remote_tree_hash="${dir_hashes[$sub_dir]}"
        local local_hash_file="$target_path/.upstream_commit"
        
        if [ -d "$sub_dir" ]; then
            rm -rf "$target_path"
            mv "$sub_dir" "$target_path"
            
            PATCH_MARK=""
            [ -d "$TARGET_DIR/.github/patches/$target_name" ] && PATCH_MARK=" [patched]"
            
            if [ "$repo_header_printed" = false ]; then
                echo "📁 [$repo_path]" >> "$SUMMARY_FILE"
                repo_header_printed=true
            fi
            
            local specific_commit_msg=$(git log -1 --pretty=format:"%s (%h)" -- "$sub_dir")
            [ -z "$specific_commit_msg" ] && specific_commit_msg=$(git log -1 --pretty=format:"%s (%h)")
            
            echo "  - $target_name$PATCH_MARK: $specific_commit_msg" >> "$SUMMARY_FILE"
            echo -n "$remote_tree_hash" > "$local_hash_file"
            echo "✅ Extraction successful: $target_name"
            
            echo "$target_name|$target_name$PATCH_MARK: $specific_commit_msg" >> "$COMMIT_QUEUE"
        else
            echo "❌ Extraction failed: $sub_dir"
            if ! grep -Fxq "$target_name" "$WHITELIST_FILE" 2>/dev/null; then
                echo "$target_name" >> "$WHITELIST_FILE"
                echo "🛡️  Auto-added '$target_name' to whitelist.txt"
            fi
        fi
    done
    
    popd >/dev/null
    rm -rf "$tmp_dir"
}
for entry in "${SPARSE_REPOS[@]}"; do
    entry=$(echo "$entry" | tr -d '\r\n')    
    IFS='|' read -r repo branch sub_dirs <<< "$entry"
    process_sparse_repo "$repo" "$branch" "$sub_dirs"
done

# =======================================================
# Phase 3 & 4: Inject patches Patches & Fix Makefiles
# =======================================================
echo ""
echo "---------------------------------------------------"
echo "🔧 Phase 3 & 4: Applying Patches and Makefiles"
echo "---------------------------------------------------"
if [ -s "$COMMIT_QUEUE" ]; then
    while IFS='|' read -r pkg_name _rest; do
        pkg_name=$(echo "$pkg_name" | tr -d '\r\n')
        pkg_patch_dir="$TARGET_DIR/.github/patches/$pkg_name"
        real_pkg_dir="$TARGET_DIR/$pkg_name"

        if [ -d "$pkg_patch_dir" ] && [ -d "$real_pkg_dir" ]; then
            find "$pkg_patch_dir" -type f -name "*.patch" 2>/dev/null | while read -r src_patch; do
                [ ! -f "$src_patch" ] && continue
                
                rel_patch_path="${src_patch#$pkg_patch_dir/}"
                
                patch_filename=$(basename "$src_patch")
                rel_sub_dir=$(dirname "$rel_patch_path")
                
                if [ "$rel_sub_dir" = "." ]; then
                    dest_patch_dir="$real_pkg_dir/patches"
                else
                    dest_patch_dir="$real_pkg_dir/$rel_sub_dir/patches"
                fi
                
                mkdir -p "$dest_patch_dir"
                echo "Staging patchset for $pkg_name ($rel_sub_dir) -> $dest_patch_dir/$patch_filename"
                cp -f "$src_patch" "$dest_patch_dir/$patch_filename" 2>/dev/null || true
            done
        fi
    done < "$COMMIT_QUEUE"
else
    echo "💤 No upstream updates detected. Skipping patch injection."
fi

cd "$TARGET_DIR"
for folder in *; do
    if [ -d "$folder" ] && [ -f "$folder/Makefile" ]; then
        if grep -q "include ../../luci.mk" "$folder/Makefile"; then
            sed -i 's|include \.\./\.\./luci\.mk|include $(TOPDIR)/feeds/luci/luci.mk|g' "$folder/Makefile"
        fi
    fi
done

echo ""
echo "---------------------------------------------------"
echo "🛠️ Phase 4.5: Executing Patches Shell Scripts"
echo "---------------------------------------------------"

if [ -s "$COMMIT_QUEUE" ]; then
    while IFS='|' read -r pkg_name _rest; do
        pkg_name=$(echo "$pkg_name" | tr -d '\r\n')   
        sh_file="$TARGET_DIR/.github/patches/scripts/${pkg_name}.sh"
        if [ -f "$sh_file" ]; then
            script_name=$(basename "$sh_file")
            echo "🚀 Running patches script for $pkg_name: $script_name"     
            chmod +x "$sh_file"      
            (cd "$TARGET_DIR" && bash "$sh_file")  
            if [ $? -eq 0 ]; then
                echo "✅ Successfully executed $script_name"
            else
                echo "❌ Execution failed for $script_name"
            fi
        fi
    done < "$COMMIT_QUEUE"
else
    echo "💤 No upstream updates detected. Skipping patches scripts."
fi

# =======================================================
# 🚀 Phase 5: Atomic Git Commits
# =======================================================
echo ""
echo "---------------------------------------------------"
echo "🚀 Phase 5: Executing Atomic Git Commits"
echo "---------------------------------------------------"

cd "$TARGET_DIR"
if [ -s "$COMMIT_QUEUE" ]; then
    while IFS='|' read -r pkg_dir commit_msg || [ -n "$pkg_dir" ]; do
        pkg_dir=$(echo "$pkg_dir" | tr -d '\r\n')
        if [ -d "$pkg_dir" ]; then
            git add "$pkg_dir"
            git add -f "$pkg_dir/.upstream_commit" &>/dev/null || true
            
            if [ -n "$(git status --porcelain "$pkg_dir")" ]; then
                git commit -m "$commit_msg"
                echo "✅ Committed individual update for: $pkg_dir"
            else
                echo "💤 No changes to commit for: $pkg_dir"
            fi
        fi
    done < "$COMMIT_QUEUE"
    rm -f "$COMMIT_QUEUE"
else
    echo "💤 No new plugin updates needed committing."
fi

git add .
if ! git diff --staged --quiet; then
    git commit -m "chore: update workflow metadata and whitelist"
fi

echo ""
echo "---------------------------------------------------"
echo "🎉 All atomic commits processed safely!"
