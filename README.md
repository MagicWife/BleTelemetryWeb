# BLE Telemetry Aircraft HUD - 3D 飞机终极版

本版升级内容：

- 立方体姿态 -> Three.js 3D 飞机模型
- 平滑四元数旋转（Quaternion Slerp）
- 环形姿态参考圈
- 网格地面与光照效果
- HUD 数值叠加显示
- 保留原 BLE / 地图 / CSV 导出逻辑

## 文件
- index.html
- style.css
- app.js

## 注意
1. `app.js` 采用 ES Module，并从 unpkg 加载 Three.js。
2. 建议部署到 GitHub Pages 或任意 HTTPS 静态站点。
3. 地图服务与 Web Bluetooth 在本地 file:// 下体验通常不如正式部署后稳定。


修复：改为普通 script 加载 Three.js，避免某些环境下 module 导致整页 JS 不执行。

再次修复：删除重复声明的 `aircraftView`，上一版因为 JS 语法错误导致按钮事件没有绑定。

最终修复：删除了前面那处重复的 `const aircraftView = ...` 声明。

修复：重新调整了 3D 相机、飞机位置、姿态轴映射与参考圈尺寸，确保飞机始终在 HUD 中央可见。