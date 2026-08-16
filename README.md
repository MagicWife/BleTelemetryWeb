online web: https://github.com/MagicWife/BleTelemetryWeb/

# BLE Telemetry Aircraft HUD

一个基于浏览器的 BLE 遥测监控静态网页，支持：

- Web Bluetooth 连接 BLE 设备
- 自动匹配 `FFF0 / FFF1 / FFF2`
- Notify 数据接收
- 固定长度二进制帧的跨 Notify 拼包与 CRC16 校验
- 遥测解析与实时显示
- IMU 温度实时显示与波形
- QMC5883P 三轴磁场数据显示与实时波形
- 3D 飞机姿态显示
- 电压条显示
- 最近帧缓存
- CSV 导出

## 项目文件

- `index.html`：主页面结构
- `style.css`：界面样式
- `app.js`：BLE、遥测解析、姿态显示、CSV 导出等核心逻辑

## 功能说明

### 1. 蓝牙连接
点击“连接蓝牙”后，网页会调用浏览器的 Web Bluetooth 接口搜索并连接 BLE 设备。

### 2. 数据接收
连接成功后，程序会订阅设备 Notify 特征值。二进制流可以跨多个 Notify 到达，网页根据 `A5 5A` 帧头和长度字段重新拼帧，并在 CRC16 校验通过后解析。

BLE 接收与页面渲染相互独立：所有有效帧均可被记录，界面只以 25 FPS 使用最新样本刷新，波形图以 10 FPS 重绘。

### 3. 数据解析
收到完整帧后，程序会解析以下内容：

- MAC
- IMU 温度
- 加速度 AX / AY / AZ
- 陀螺仪 GX / GY / GZ
- Roll / Pitch / Yaw
- 电池电压 V1（PA1）
- QMC5883P 三轴磁场 MX / MY / MZ（Gauss）
- 电量百分比：按 `clamp(PA1 / 3.7 × 100%, 0%, 100%)` 计算
- MCU 启动后运行时间

当前 MCU 使用 46 字节、小端序的二进制帧：

| 偏移 | 长度 | 字段 | 编码 |
|---:|---:|---|---|
| 0 | 2 | 帧头 | `A5 5A` |
| 2 | 1 | 协议版本 | `01` |
| 3 | 1 | 总帧长 | `46` |
| 4 | 2 | 序号 | `uint16` |
| 6 | 6 | MAC | 显示顺序的 6 字节 |
| 12 | 2 | 温度 | `int16 / 100` °C |
| 14 | 6 | AX / AY / AZ | 三个 `int16 / 100` m/s² |
| 20 | 6 | GX / GY / GZ | 三个 `int16 / 100` rad/s |
| 26 | 6 | Roll / Pitch / Yaw | 三个 `int16 / 100` 度 |
| 32 | 2 | 电池电压 | `uint16 / 1000` V |
| 34 | 6 | MX / MY / MZ | 三个 `int16 / 1000` Gauss |
| 40 | 4 | 运行时间 | `uint32` ms |
| 44 | 2 | 校验 | CRC16-CCITT，覆盖字节 0–43 |

### 4. 姿态显示
页面集成 Three.js 飞机姿态视图，用于显示 roll / pitch / yaw 的实时变化。

### 5. 记录 CSV
点击“开始记录”后，所有通过 CRC 校验的二进制帧都会写入记录缓存；停止记录时下载 CSV。文件同时保存原始帧十六进制、协议版本、帧长、序号、CRC 和全部解码字段，便于定位链路丢帧。

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

2. 如果蓝牙连接按钮无反应，请检查：
   - 浏览器是否支持 Web Bluetooth
   - 页面是否通过 HTTPS 打开
   - 控制台是否有 JS 报错

## 本地测试

可以在项目目录运行：

```bash
python -m http.server 8000
```

online web: https://zhanghengee.github.io/BleTelemetryWeb/
