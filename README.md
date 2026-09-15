online web: https://github.com/MagicWife/BleTelemetryWeb/

# BLE Telemetry Aircraft HUD

已接入 `Animal_detection2/imu-zqy/web/imu` 的实时 IMU 心率与呼吸率算法。连接设备后约 10 秒开始预测，约每秒更新，支持置信度、趋势图（质量门控已移除）。详见 [IMU 接入说明](./IMU-INTEGRATION.md)。

一个基于浏览器的 BLE 遥测监控静态网页，支持：

- Web Bluetooth 连接 BLE 设备
- 自动匹配 `FFF0 / FFF1 / FFF2`
- Notify 数据接收
- 固定长度二进制帧的跨 Notify 拼包与 CRC16 校验
- 遥测解析与实时显示
- IMU 温度实时显示与波形
- 磁校正、磁异常、六轴回退及传感器数据过期状态
- 3D 飞机姿态显示
- 电压条显示
- 最近帧缓存
- 每 5 分钟自动分片的物理量 CSV 导出

## 项目文件

- `index.html`：主页面结构
- `style.css`：界面样式
- `app.js`：BLE、遥测解析、姿态显示、CSV 导出等核心逻辑

## 功能说明

### 1. 蓝牙连接
点击“连接蓝牙”后，网页会调用浏览器的 Web Bluetooth 接口搜索并连接 BLE 设备。

发送周期参数 `Tcycle` 的页面默认值为 20 ms。

### 2. 数据接收
连接成功后，程序会订阅设备 Notify 特征值。二进制流可以跨多个 Notify 到达，网页根据 `A5 5A` 帧头和长度字段重新拼帧，并在 CRC16 校验通过后解析。

BLE 接收与页面渲染相互独立：所有有效帧均可被记录，实时数值、波形图和 3D 姿态以 20 FPS 使用最新样本刷新。原始二进制解析仍在每次 Notify 到达时立即执行，不会因为界面刷新率限制而漏掉记录数据。

### 3. 数据解析
收到完整帧后，程序会解析以下内容：

- MAC
- IMU 温度
- 加速度 AX / AY / AZ
- 陀螺仪 GX / GY / GZ
- Roll / Pitch / Yaw
- 电池电压 V1（PA1）
- 姿态状态字及7个状态位（不再接收三轴磁场）
- 电量百分比：按 `clamp((电池电压 - 2.5 V) / 1.2 V × 100%, 0%, 100%)` 计算
- MCU 启动后运行时间

当前网页仅支持 MCU v2 的42字节小端二进制帧，收到v1时提示升级固件：

| 偏移 | 长度 | 字段 | 编码 |
|---:|---:|---|---|
| 0 | 2 | 帧头 | `A5 5A` |
| 2 | 1 | 协议版本 | `02` |
| 3 | 1 | 总帧长 | `42` |
| 4 | 2 | 序号 | `uint16` |
| 6 | 6 | MAC | 显示顺序的 6 字节 |
| 12 | 2 | 温度 | `int16 / 100` °C |
| 14 | 6 | AX / AY / AZ | 三个 `int16 / 100` m/s² |
| 20 | 6 | GX / GY / GZ | 三个 `int16 / 100` rad/s |
| 26 | 6 | Roll / Pitch / Yaw | 三个 `int16 / 100` 度 |
| 32 | 2 | 电池电压 | `uint16 / 1000` V |
| 34 | 2 | 状态位 | `uint16` |
| 36 | 4 | 运行时间 | `uint32` ms |
| 40 | 2 | 校验 | CRC16-CCITT，覆盖字节 0–39 |

状态位：bit0磁校正有效，bit1磁异常，bit2六轴回退，bit3姿态已初始化，bit4磁数据超时，bit5 IMU过期，bit6磁校准参数启用。未知高位忽略。
bit1是最近被拒绝的磁数据状态，不代表累计错误数，也不能证明物理上一定存在磁干扰。bit6不是当前航向精度的保证。

### 4. 姿态显示
页面集成 Three.js 飞机姿态视图，用于显示 roll / pitch / yaw 的实时变化。
等待初始化、IMU过期、协议不匹配或整条遥测流超时后暂停动画。六轴回退仍显示姿态，但提示航向可能漂移。
流超时阈值为max(1秒, 网页最近发送周期的3倍)；此时状态位标注为历史值，不把最后一帧当成实时状态。
未收到新数据时不重复往波形插入同一采样点。

### 5. 记录 CSV
点击“开始记录”后，所有通过 CRC 校验的数据都会记录。网页每 5 分钟自动下载一个 CSV 文件，文件生成后立即切换到新的空缓存；点击“停止记录”或蓝牙断开时，会另行下载当前不足 5 分钟的剩余数据。

CSV 时间戳固定采用北京时间（UTC+8），格式为 `YYYY-MM-DD HH:mm:ss.SSS+08:00`。文件保存解析后的可读物理量及状态：

- IMU 温度（°C）
- 三轴加速度（m/s²）
- 三轴角速度（rad/s）
- Roll / Pitch / Yaw（°）
- 电池电压（V）和电量百分比（%）
- MCU 启动后运行时间 `uptime_ms`（ms）
- `attitude_status`（十进制状态字）、`fusion_state`（可读状态描述）
- `mag_active,mag_rejected,six_axis,attitude_ready,mag_stale,imu_stale,mag_calibrated`（0/1，1表示该位有效）

CSV状态为接收帧携带的设备状态，不额外编造超时采样行。数据过期的帧仍保留原值及其标志，分析时应过滤不可靠姿态。

CSV 不再保存原始十六进制帧、协议版本、帧长、序号、MAC 或 CRC。连续记录时，浏览器可能询问是否允许当前网站自动下载多个文件，需要选择允许。

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
