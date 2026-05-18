online web: https://github.com/MagicWife/BleTelemetryWeb/

# BLE Telemetry Aircraft HUD

一个基于浏览器的 BLE 遥测监控静态网页，支持：

- Web Bluetooth 连接 BLE 设备
- 自动匹配 `FFF0 / FFF1 / FFF2`
- Notify 数据接收
- `$...*` 分包拼帧
- 遥测解析与实时显示
- 3D 飞机姿态显示
- 地图定位显示
- 电压条显示
- 最近帧缓存
- CSV 导出

## 项目文件

- `index.html`：主页面结构
- `style.css`：界面样式
- `app.js`：BLE、地图、姿态显示、CSV 导出等核心逻辑

## 功能说明

### 1. 蓝牙连接
点击“连接蓝牙”后，网页会调用浏览器的 Web Bluetooth 接口搜索并连接 BLE 设备。

### 2. 数据接收
连接成功后，程序会订阅设备 Notify 特征值，接收字符串数据，并按 `$...*` 进行拼帧处理。

### 3. 数据解析
收到完整帧后，程序会解析以下内容：

- MAC
- 时间
- 经度 / 纬度
- 加速度 AX / AY / AZ
- 陀螺仪 GX / GY / GZ
- Roll / Pitch / Yaw
- 电压 V1 / V5 / V6

### 4. 姿态显示
页面集成 Three.js 飞机姿态视图，用于显示 roll / pitch / yaw 的实时变化。

### 5. 地图显示
页面集成 Leaflet 地图，支持显示设备当前位置，并自动进行 WGS84 / GCJ02 处理。

### 6. 导出 CSV
点击“导出 CSV”按钮，可将当前接收到的遥测数据导出为 CSV 文件。

## 运行要求

推荐浏览器：

- Chrome
- Edge

不推荐：

- iPhone / iPad Safari
- 不支持 Web Bluetooth 的浏览器

## 注意事项

1. Web Bluetooth 必须在受信任环境中使用，通常需要：
   - `https://` 页面
   - 或 `http://localhost`

2. 地图瓦片服务在本地直接双击 `index.html` 打开时，可能因为 Referer 限制而异常。  
   建议部署到 GitHub Pages 后再测试。

3. 如果蓝牙连接按钮无反应，请检查：
   - 浏览器是否支持 Web Bluetooth
   - 页面是否通过 HTTPS 打开
   - 控制台是否有 JS 报错

## 本地测试

可以在项目目录运行：

```bash
python -m http.server 8000



online web: https://zhanghengee.github.io/BleTelemetryWeb/
