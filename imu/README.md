# Web IMU 实时心率与呼吸率模块

## 模块说明

本目录提供可在浏览器中运行的 IMU 实时心率（HR）与呼吸率（RR）预测模块。

该模块与原有毫米波雷达预测流程相互独立。页面只把 BLE 实时采集的三轴加速度和三轴陀螺仪样本旁路发送给 IMU Worker，不修改毫米波算法状态、BLE 采集缓存、录制内容、补传数据或上传流程。

## 主要功能

- 接收三轴加速度 `ax/ay/az` 和三轴陀螺仪 `gx/gy/gz` 实时样本。
- 完成姿态估计、重力去除和心率/呼吸率信号构建。
- 使用10秒、20秒和30秒因果窗口生成候选峰。
- 通过质量门控、候选评分、Beam、权威历史、checkpoint和长期轨迹选择最终结果。
- 每约1秒输出一次心率、呼吸率、置信度、质量状态和候选峰。
- 在 Web Worker 中执行计算，避免阻塞页面、BLE接收和毫米波处理。
- 连接、断开、清空数据或采样率变化时，独立重置 IMU 实时会话。

## 目录结构

```text
web/imu/
├─ config.js                       算法参数
├─ package.json                    测试与构建命令
├─ src/
│  ├─ baseline/                    候选峰、Beam、轨迹和仲裁逻辑
│  ├─ browser/worker-entry.js      浏览器 Worker 消息入口
│  ├─ imu/                         姿态估计与重力去除
│  ├─ quality/                     原始 IMU 质量门控
│  ├─ realtime/                    实时会话适配器
│  ├─ signal/                      FFT、滤波和信号处理
│  └─ state/                       运动状态判断
├─ tests/                          实时性与长期状态回归测试
└─ dist/imu-vitals.worker.js       页面实际加载的 Worker 构建文件
```

页面侧显示与 Worker 管理由 `web/imu-vitals-panel.js` 负责，BLE 实时送样入口位于 `web/app.js`。

## 实时数据流程

```text
BLE 实时样本
  → 主程序判定为 live
  → imu-vitals-panel.js
  → imu-vitals.worker.js
  → 质量门控与 IMU 算法全流程
  → HR/RR、置信度、候选峰和运行状态
  → 页面实时卡片与趋势图
```

补传样本不会进入该流程。

## 输入单位与输出

当前网页接入使用：

- 加速度：`m/s²`
- 陀螺仪：`deg/s`
- 默认采样率：`50 Hz`

主要输出包括：

- `HR_bpm`：预测心率。
- `RR_bpm`：预测呼吸率。
- `HR_confidence`、`RR_confidence`：结果置信度。
- `quality_gate_passed`：质量门控是否通过。
- `motion_state`：运动/质量状态。
- `available_windows`：当前可用的10秒、20秒和30秒窗口。
- `candidates`：当前心率候选峰。

质量门控明确拒绝时，页面显示无效值而不是用0代替。

## 预热与长期状态

- 约10秒后可以产生第一组预测。
- 约20秒和30秒后，相应的长窗口逐步加入候选判断。
- 会话持续约60秒后，长期候选轨迹可以充分成熟。
- 算法状态由实时实例持续持有，不会在每次预测时重新从0开始。


