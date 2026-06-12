#!/bin/sh

# 定义目标文件路径 (请根据实际情况调整路径)
FILE="luci-app-quickfile/luci-app-quickfile/root/usr/share/luci/menu.d/luci-app-quickfile.json"

# 1. 判断文件是否存在
if [ -f "$FILE" ]; then
    # 2. 判断文件中是否已经包含 "order": 79 (忽略空格差异)
    if grep -q '"order":[[:space:]]*79' "$FILE"; then
        echo "提示: order 的值已经是 79，无需修改。"
    else
        echo "发现 order 值不是 79，正在进行修改..."
        
        # 3. 使用 sed 命令精准替换数字
        # 这里会匹配 "order": 后面跟着任意空格和数字，并替换为 "order": 79
        # 后面的逗号 `,` 会被自动保留
        sed -i 's/"order":[[:space:]]*[0-9]*/"order": 79/' "$FILE"
        
        echo "修改完成！"
    fi
else
    echo "错误: 文件不存在 ($FILE)"
    exit 1
fi
