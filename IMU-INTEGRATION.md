# IMU 心率 / 呼吸率接入说明

## 来源

- 目标项目：[MagicWife/BleTelemetryWeb](https://github.com/MagicWife/BleTelemetryWeb)，基于 2026-09-14 下载的 main 分支。
- 算法来源：[GeorgeGuo1215/Animal_detection2 的 imu-zqy/web/imu](https://github.com/GeorgeGuo1215/Animal_detection2/tree/imu-zqy/web/imu)。
- 固定参考提交：`6a9763b8198dad0dcb7578da8e76c441e2bc1ce8`。
- `imu/` 中 30 个原始文件保持与该提交一致，包含配置、源代码、预构建 Worker 和原有测试。该目录中的原始 README 描述的是参考项目；本项目接入方式以本文为准。

## 使用

在项目目录运行 `python -m http.server 8000`，使用 Chrome / Edge 打开 `http://localhost:8000`，或把整个目录作为静态站点部署到 HTTPS。直接双击 HTML 不适用于 Worker 和 Web Bluetooth。

连接设备后，保持佩戴稳定、尽量静止。默认 Tcycle 建议 20 ms（50 Hz）。约 10 秒开始预测，以后约每秒更新；20 秒、30 秒长窗口逐渐加入，约 60 秒完成长期轨迹预热。首个可靠数值可能晚于 10 秒，因为质量和候选置信度也必须满足原算法要求。

页面显示心率、呼吸率、各自置信度、质量状态、实际采样率、分析窗口、测量时长和最近 300 个预测点的趋势图。任何无效值显示 `--`，趋势图保留缺口。点击“重新测量”可清空算法历史并重启当前测量。

## 数据流与单位

`BLE Notify → 原有跨包拼帧 → CRC16 校验 → parseTelemetryFrame → acceptTelemetryFrame → imu-vitals.js → imu/dist/imu-vitals.worker.js → 结果与趋势图`

- 每个有效遥测帧送样一次，送样不依赖 20 FPS 的显示刷新。一个 Notify 中的多个完整帧都会进入算法。
- `ax/ay/az` 是 `m/s²`，原样传入，Worker 使用 `accelUnit: 'mps2'`。
- `gx/gy/gz` 是 `rad/s`，原样传入，Worker 使用 `gyroUnit: 'rad'`；原算法在入口转换一次到 `deg/s`。
- 通过连续帧 MCU `uptime_ms` 差值的中位数识别采样周期，不使用 Notify 到达间隔，也不把尚未确认生效的发送指令当作设备实际周期。
- 起始校准样本全部补送给 Worker；校准使用最多 25 个间隔，或累计 1 秒。此接入层支持 10–200 Hz（Tcycle 5–100 ms），建议 50 Hz。
- 原算法按等间隔样本计算。重复帧忽略；丢帧、乱序、设备重启、明显采样周期变化时清空历史重新采集，避免把不连续信号压缩成连续时间。序号和 uptime 的正常无符号回绕可连续处理。
- 断开蓝牙或超过 3 秒没有新样本会清除读数；数据恢复后重新预热。算法错误、响应超时或队列明显落后时终止 Worker 并清空读数，可通过“重新测量”恢复。
- 保留原始 46 字节协议、CSV 字段与记录节奏、姿态显示和已有波形。

## 原算法限制

参数保持原样：心率频带 30–220 bpm，正式呼吸率输出范围 10–30 次/分。范围外的呼吸不能靠这个移植版本正确覆盖；如需监测更快呼吸，应另行调整算法并用真实标注数据验证。强运动、冲击或异常原始信号会触发原有质量门控，不强行显示数值。

## 验证

无需安装依赖即可运行：

```sh
npm test
```

包含接入层测试及原算法三个回归测试文件，验证帧解析与 CRC、每帧送样、单位传递、采样周期变化、丢帧和计数器回绕、无效值显示、断连与超时、旧会话结果隔离，以及预构建 Worker 与源代码在相同合成输入下的输出一致性。

`tests/browser-smoke.html` 提供明确标注为合成数据的浏览器 Worker 测试，不连接真实蓝牙。

算法参数或源代码改变后才需要重建 Worker：

```sh
cd imu
npm ci
npm run check
```

本次完成软件测试和浏览器页面检查，未使用实际 BLE 硬件或宠物标注数据验证测量准确率。
