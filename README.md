online web: https://github.com/MagicWife/BleTelemetryWeb/

# BLE Telemetry Aircraft HUD

一个基于浏览器的 BLE 遥测监控静态网页，支持：

- Web Bluetooth 连接 BLE 设备
- 自动匹配 `FFF0 / FFF1 / FFF2`
- Notify 数据接收
- `$...*` 分包拼帧
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
连接成功后，程序会订阅设备 Notify 特征值，接收字符串数据，并按 `$...*` 进行拼帧处理。

### 3. 数据解析
收到完整帧后，程序会解析以下内容：

- MAC
- IMU 温度
- 加速度 AX / AY / AZ
- 陀螺仪 GX / GY / GZ
- Roll / Pitch / Yaw
- 电池电压 V1、ADC 电压 V5 / V6
- QMC5883P 三轴磁场 MX / MY / MZ（Gauss）
- 电量百分比：按 `clamp(PA1 / 3.7 × 100%, 0%, 100%)` 计算
- MCU 启动后运行时间

当前 MCU 数据帧格式：

```text
$MAC,tmp,AccX,AccY,AccZ,GyroX,GyroY,GyroZ,Roll,Pitch,Yaw,PA1,PA5,PA6,MagX,MagY,MagZ,运行时间*\r\n
```

### 4. 姿态显示
页面集成 Three.js 飞机姿态视图，用于显示 roll / pitch / yaw 的实时变化。

### 5. 导出 CSV
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
