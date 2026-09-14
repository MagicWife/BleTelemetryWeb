/* BLE adapter for Animal_detection2/imu-zqy/web/imu. See IMU-INTEGRATION.md. */
(function () {
  'use strict';
  const fields = ['ax', 'ay', 'az', 'gx', 'gy', 'gz'];
  const text = (id, value) => { document.getElementById(id).textContent = value; };
  const median = values => {
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  class ImuVitals {
    constructor() {
      this.generation = 0;
      this.chart = null;
      if (typeof Chart !== 'undefined') {
        this.chart = new Chart(document.getElementById('vitalsTrend'), {
          type: 'line',
          data: { datasets: [
            { label: '心率 (bpm)', data: [], borderColor: '#ff7b88', yAxisID: 'hr', pointRadius: 0, borderWidth: 2, spanGaps: false },
            { label: '呼吸率 (次/分)', data: [], borderColor: '#37d29f', yAxisID: 'rr', pointRadius: 0, borderWidth: 2, spanGaps: false }
          ] },
          options: {
            animation: false, parsing: false, responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#96aac7' } } },
            scales: {
              x: { type: 'linear', title: { display: true, text: '测量时间 (s)', color: '#96aac7' }, ticks: { color: '#96aac7' } },
              hr: { position: 'left', suggestedMin: 30, suggestedMax: 220, ticks: { color: '#ff7b88' } },
              rr: { position: 'right', suggestedMin: 10, suggestedMax: 30, ticks: { color: '#37d29f' }, grid: { drawOnChartArea: false } }
            }
          }
        });
      }
      this.reset('等待蓝牙连接');
      this.timer = window.setInterval(() => this.checkFreshness(), 500);
    }

    reset(label = '等待实时数据', active = false) {
      if (this.worker) this.worker.terminate();
      this.worker = null;
      this.sessionId = ++this.generation;
      this.active = active;
      this.previous = null;
      this.intervals = [];
      this.pending = [];
      this.sampleRateHz = null;
      this.sampleCount = 0;
      this.predictionCount = 0;
      this.lastReceiveAt = null;
      this.startedAt = null;
      this.lastPredictionAt = null;
      this.clearValues();
      if (this.chart) {
        this.chart.data.datasets.forEach(dataset => { dataset.data = []; });
        this.chart.update('none');
      }
      this.setState(label, 'warming');
    }

    startSession(label = '等待数据，自动识别采样率') {
      this.reset(label, true);
    }

    clearValues() {
      text('vitalsHR', '--');
      text('vitalsRR', '--');
      text('vitalsHRConfidence', '--');
      text('vitalsRRConfidence', '--');
      text('vitalsQuality', '--');
      text('vitalsFs', '--');
      text('vitalsWindows', '--');
      text('vitalsElapsed', '--');
      text('vitalsDetail', '连续采集约 10 秒开始预测，约 60 秒完成长期轨迹预热。');
    }

    setState(label, state) {
      text('vitalsStatus', label);
      document.getElementById('vitalsStatus').dataset.state = state;
    }

    fail(label) {
      this.reset(label);
      this.setState(label, 'error');
    }

    pushSample(tele) {
      if (!this.active) return;
      if (!fields.every(key => Number.isFinite(tele[key]))) {
        this.startSession('样本无效，重新采集');
        return;
      }
      const now = Date.now();
      if (this.lastReceiveAt !== null && now - this.lastReceiveAt > 3000) {
        this.startSession('数据中断后恢复，重新采集');
      }
      if (this.previous) {
        const sequenceDelta = (tele.sequence - this.previous.sequence + 65536) % 65536;
        // Unsigned differences handle the MCU uptime and sequence counter wrap.
        const dt = (tele.ms - this.previous.ms + 4294967296) % 4294967296;
        if (sequenceDelta === 0 && dt === 0) return;
        if (sequenceDelta === 1 && dt > 1000 && dt <= 10000) {
          this.fail('采样率不支持：请设置 Tcycle 为 5–100 ms 后重新测量');
          return;
        }
        if (sequenceDelta !== 1 || dt <= 0 || dt > 1000) {
          this.startSession('帧不连续或设备重启，重新采集');
        } else {
          this.intervals.push(dt);
          if (this.intervals.length > 25) this.intervals.shift();
          if (this.sampleRateHz && this.intervals.length === 25) {
            const period = 1000 / this.sampleRateHz;
            if (Math.abs(median(this.intervals) - period) > Math.max(2, period * 0.1)) {
              this.startSession('采样周期变化，重新采集');
            }
          }
        }
      }
      this.previous = { sequence: tele.sequence, ms: tele.ms };
      this.lastReceiveAt = now;
      const sample = {};
      fields.forEach(key => { sample[key] = tele[key]; });
      if (!this.worker) {
        this.pending.push(sample);
        if (this.pending.length > 256) {
          this.startSession('采样时间异常，重新采集');
          return;
        }
        // Count device time, not Notify arrival time: a Notify may contain many frames.
        this.calibrationMs = this.intervals.reduce((sum, value) => sum + value, 0);
        if (this.intervals.length < 25 && this.calibrationMs < 1000) return;
        this.sampleRateHz = 1000 / median(this.intervals);
        if (this.sampleRateHz < 10 || this.sampleRateHz > 200) {
          this.fail('采样率不支持：请设置 Tcycle 为 5–100 ms 后重新测量');
          return;
        }
        if (!this.createWorker()) return;
        const buffered = this.pending;
        this.pending = [];
        buffered.forEach(item => this.sendSample(item));
      } else {
        this.sendSample(sample);
      }
    }

    createWorker() {
      try {
        const sessionId = this.sessionId;
        this.worker = new Worker('./imu/dist/imu-vitals.worker.js');
        this.worker.onmessage = event => {
          const message = event.data || {};
          if (sessionId !== this.sessionId || message.sessionId !== sessionId) return;
          if (message.type === 'prediction') this.renderPrediction(message.result);
          if (message.type === 'error') this.fail(`算法错误：${message.message}`);
        };
        this.worker.onerror = event => {
          if (sessionId === this.sessionId) this.fail(`算法加载失败：${event.message || '请通过 HTTPS 或 localhost 打开页面'}`);
        };
        this.worker.onmessageerror = () => {
          if (sessionId === this.sessionId) this.fail('算法消息读取失败，请重新测量');
        };
        this.worker.postMessage({
          type: 'init', sessionId,
          options: { sampleRateHz: this.sampleRateHz, stepSec: 1, replayHistorySec: 70, accelUnit: 'mps2', gyroUnit: 'rad' }
        });
        this.startedAt = Date.now();
        text('vitalsFs', `${this.sampleRateHz.toFixed(1)} Hz`);
        this.setState('预热中，首个结果约 10 秒', 'warming');
        return true;
      } catch (error) {
        this.fail(`算法不可用：${error.message}`);
        return false;
      }
    }

    sendSample(sample) {
      if (!this.worker) return;
      try {
        this.worker.postMessage({ type: 'sample', sessionId: this.sessionId,
          sample: { ...sample, timestamp_s: this.sampleCount / this.sampleRateHz } });
        this.sampleCount++;
      } catch (error) {
        this.fail(`实时送样失败：${error.message}`);
        return;
      }
      // Bound queued work if computation cannot keep up with acquisition.
      const maximumLagSeconds = this.predictionCount > 0 ? 5 : 20;
      if (this.sampleCount - this.predictionCount > this.sampleRateHz * maximumLagSeconds) {
        this.fail('算法处理滞后，请设置 Tcycle 为 20 ms 后重新测量');
      }
    }

    checkFreshness() {
      if (!this.active || this.lastReceiveAt === null) return;
      if (Date.now() - this.lastReceiveAt > 3000) {
        this.startSession('数据已中断，等待恢复后重新采集');
      } else if (this.worker && (this.lastPredictionAt !== null
        ? Date.now() - this.lastPredictionAt > 5000
        : Date.now() - this.startedAt > 20000)) {
        this.fail('算法响应超时，请重新测量');
      }
    }

    renderPrediction(result) {
      if (!result || !this.active) return;
      this.lastPredictionAt = Date.now();
      this.predictionCount = Math.round(result.session_elapsed_s * this.sampleRateHz);
      const quality = result.quality_gate_passed === true;
      const valid = (value, flag) => quality && flag === true && Number.isFinite(value) && value > 0;
      const hr = valid(result.HR_bpm, result.heart_valid) ? result.HR_bpm : null;
      const rr = valid(result.RR_bpm, result.respiratory_valid) ? result.RR_bpm : null;
      const confidence = (value, rate) => rate !== null && Number.isFinite(value)
        ? `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` : '--';
      text('vitalsHR', hr === null ? '--' : hr.toFixed(1));
      text('vitalsRR', rr === null ? '--' : rr.toFixed(1));
      text('vitalsHRConfidence', confidence(result.HR_confidence, hr));
      text('vitalsRRConfidence', confidence(result.RR_confidence, rr));
      text('vitalsQuality', quality ? '通过' : '未通过');
      text('vitalsWindows', (result.available_windows || []).map(value => `${value}s`).join(' / ') || '--');
      text('vitalsElapsed', `${result.session_elapsed_s.toFixed(0)} s`);
      const reasons = (result.quality_reject_reasons || []).join('、');
      text('vitalsDetail', reasons || (result.fully_warmed_up ? '长期轨迹预热完成' : `长期轨迹预热 ${Math.round(result.warmup_progress * 100)}%`));
      this.setState(!quality ? '信号质量不足，请保持静止' : hr === null && rr === null
        ? '暂无可靠结果，继续采集' : result.fully_warmed_up ? '实时预测中' : '实时预测中 · 长期轨迹预热',
      quality ? 'running' : 'rejected');
      if (this.chart) {
        [hr, rr].forEach((value, index) => {
          const data = this.chart.data.datasets[index].data;
          data.push({ x: result.session_elapsed_s, y: value });
          while (data.length > 300) data.shift();
        });
        this.chart.update('none');
      }
    }
  }
  window.ImuVitals = ImuVitals;
})();
