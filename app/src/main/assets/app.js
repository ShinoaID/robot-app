/* ========================================================
   CYBER NEON BLUE CONTROLLER LOGIC (MULTI-PAGE SYSTEM)
   ======================================================== */

let isBleConnected = false;
let currentFaceIndex = 0;
let isRobotAsleep = false;
let currentActivePage = 'pageStatus';

// TOAST HELPER
function showNeonToast(message) {
  const toast = document.getElementById('neonToast');
  document.getElementById('toastText').textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
  triggerHaptic(20);
}

function triggerHaptic(durationMs = 25) {
  if (window.AndroidBLE && typeof window.AndroidBLE.vibrate === 'function') {
    window.AndroidBLE.vibrate(durationMs);
  } else if ('vibrate' in navigator) {
    navigator.vibrate(durationMs);
  }
}

// MULTI-PAGE NAVIGATION (NON-SCROLLABLE)
function switchPage(pageId) {
  currentActivePage = pageId;

  // Toggle page visibility
  document.querySelectorAll('.page').forEach(page => {
    page.classList.toggle('active', page.id === pageId);
  });

  // Toggle bottom tab button active states
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    const fn = btn.getAttribute('onclick');
    btn.classList.toggle('active', fn && fn.includes(pageId));
  });

  triggerHaptic(15);
}

// BLE SEND COMMAND WRAPPER
function sendCommand(cmdObject) {
  const jsonStr = JSON.stringify(cmdObject);
  if (window.AndroidBLE && typeof window.AndroidBLE.send === 'function') {
    const success = window.AndroidBLE.send(jsonStr);
    if (!success && !isBleConnected) {
      showNeonToast('Bluetooth Belum Terhubung');
    }
    return success;
  } else {
    // For browser testing / mock
    console.log('[MOCK BLE SEND]', jsonStr);
    showNeonToast('Perintah Terkirim (Mock)');
    return true;
  }
}

// BLE CONNECTION TOGGLE
function toggleBleConnection() {
  if (isBleConnected) {
    if (window.AndroidBLE && typeof window.AndroidBLE.disconnect === 'function') {
      window.AndroidBLE.disconnect();
      showNeonToast('Memutuskan Bluetooth...');
    }
  } else {
    if (window.AndroidBLE && typeof window.AndroidBLE.connect === 'function') {
      window.AndroidBLE.connect();
      showNeonToast('Memindai ESP32 C3 Robot...');
    } else {
      showNeonToast('Modul BLE Siap');
    }
  }
  triggerHaptic(30);
}

// BLE CALLBACK FROM NATIVE JAVA
window.onBLEStatus = function(connected, message) {
  isBleConnected = connected;
  const dot = document.getElementById('bleDot');
  const label = document.getElementById('bleStatusLabel');
  const btnText = document.getElementById('btnBleText');

  if (connected) {
    dot.className = 'pulse-dot online';
    label.textContent = 'BLE TERHUBUNG';
    btnText.textContent = 'PUTUSKAN';
    showNeonToast('Robot Tersambung');
    requestTelemetry();
  } else {
    dot.className = 'pulse-dot';
    label.textContent = message ? message.toUpperCase() : 'BLE TERPUTUS';
    btnText.textContent = 'SAMBUNGKAN';
  }
};

window.onBLEReceived = function(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    updateTelemetry(data);
  } catch (e) {
    console.log('[BLE RAW RECEIVE]', jsonStr);
  }
};

// TELEMETRY UPDATER
function updateTelemetry(data) {
  if (!data) return;

  // RAM telemetry with 2 decimals
  if (data.ram) {
    const freePct = data.ram.free_pct.toFixed(2);
    const usedPct = data.ram.used_pct.toFixed(2);
    const freeKb = (data.ram.heap_free / 1024).toFixed(1);
    const usedKb = (data.ram.heap_used / 1024).toFixed(1);

    document.getElementById('lblRamFreePct').textContent = `${freePct}%`;
    document.getElementById('lblRamUsedPct').textContent = `${usedPct}%`;
    document.getElementById('lblRamFreeKB').textContent = `${freeKb} KB`;
    document.getElementById('lblRamUsedKB').textContent = `${usedKb} KB`;
    document.getElementById('ramProgressBar').style.width = `${freePct}%`;
  }

  // Active Mode
  if (typeof data.mode !== 'undefined') {
    document.getElementById('lblActiveModeId').textContent = `Mode #${data.mode}`;
    document.getElementById('lblActiveModeName').textContent = data.mode_name || 'Animasi';
  }

  // Uptime
  if (data.uptime_sec) {
    const h = Math.floor(data.uptime_sec / 3600);
    const m = Math.floor((data.uptime_sec % 3600) / 60);
    const s = data.uptime_sec % 60;
    document.getElementById('lblDeviceUptime').textContent = 
      `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  // Sleep State
  if (typeof data.asleep !== 'undefined') {
    isRobotAsleep = data.asleep;
    document.getElementById('lblAsleepState').textContent = isRobotAsleep ? 'Tidur Zzz' : 'Siaga';
    document.getElementById('lblAsleepSub').textContent = isRobotAsleep ? 'Hemat Daya' : 'Aktif';
    document.getElementById('lblSleepBtnText').textContent = isRobotAsleep ? 'BANGUNKAN' : 'TIDURKAN';
  }

  // Face
  if (typeof data.face !== 'undefined') {
    highlightFace(data.face);
  }

  // Alarm
  if (data.alarm) {
    document.getElementById('alarmHourIn').value = data.alarm.hour;
    document.getElementById('alarmMinIn').value = data.alarm.min;
    document.getElementById('toggleAlarmEnable').checked = data.alarm.enabled;
    document.getElementById('toggleAlarmDaily').checked = data.alarm.daily;
  }
}

function requestTelemetry() {
  sendCommand({ cmd: 'status' });
}

// FACE ACTIONS
function selectFace(faceIdx) {
  highlightFace(faceIdx);
  showNeonToast(`Ekspresi #${faceIdx} Aktif`);
  sendCommand({ cmd: 'face', val: faceIdx });
}

function highlightFace(idx) {
  currentFaceIndex = idx;
  const items = document.querySelectorAll('.face-item');
  items.forEach((item, i) => item.classList.toggle('active-face', i === idx));
}

function sendTrigger(type) {
  showNeonToast(`Reaksi ${type.toUpperCase()}`);
  sendCommand({ cmd: type });
}

// MARQUEE ACTIONS
function submitMarquee() {
  const text = document.getElementById('inputMarqueeText').value.trim();
  if (!text) {
    showNeonToast('Ketik pesan terlebih dahulu');
    return;
  }
  showNeonToast('Teks Terkirim ke Layar');
  sendCommand({ cmd: 'msg', text: text, source: 'HP', playing: true });
}

function applyMarqueePreset(text) {
  document.getElementById('inputMarqueeText').value = text;
  submitMarquee();
}

// CLOCK & ALARM
function syncPhoneClock() {
  const epoch = Math.floor(Date.now() / 1000);
  showNeonToast('Menyinkronkan Jam...');
  sendCommand({ cmd: 'time', epoch: epoch });
}

function saveAlarmConfig() {
  const hour = parseInt(document.getElementById('alarmHourIn').value) || 0;
  const min = parseInt(document.getElementById('alarmMinIn').value) || 0;
  const en = document.getElementById('toggleAlarmEnable').checked;
  const daily = document.getElementById('toggleAlarmDaily').checked;

  showNeonToast(`Alarm ${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')} Disimpan`);
  sendCommand({ cmd: 'alarm', hour: hour, min: min, en: en, daily: daily });
}

function testAlarmSound() {
  showNeonToast('Uji Suara Alarm Buzzer');
  sendCommand({ cmd: 'alarm_test' });
}

// GAME & VIRTUAL GAMEPAD
function launchGameMode(modeVal) {
  showNeonToast(`Memulai Mode #${modeVal}`);
  sendCommand({ cmd: 'mode', val: modeVal });
}

function pressAction(e) {
  if (e) e.preventDefault();
  triggerHaptic(35);
  sendCommand({ cmd: 'action' });
}

function releaseAction(e) {
  if (e) e.preventDefault();
}

// SYSTEM & HARDWARE
function toggleSleepMode() {
  if (isRobotAsleep) {
    showNeonToast('Membangunkan Robot');
    sendCommand({ cmd: 'wake' });
  } else {
    showNeonToast('Memasuki Mode Tidur');
    sendCommand({ cmd: 'sleep' });
  }
}

function testBuzzerAudio() {
  showNeonToast('Tes Frekuensi Buzzer');
  sendCommand({ cmd: 'buzzer', freq: 2400, dur: 120 });
}

function testHapticMotor() {
  showNeonToast('Tes Motor Getar');
  sendCommand({ cmd: 'vibrate', dur: 180 });
}

function restartDevice() {
  if (confirm('Konfirmasi Restart Robot ESP32?')) {
    showNeonToast('Merestart Robot...');
    sendCommand({ cmd: 'reboot' });
  }
}

// Auto telemetry poller every 3.5s if connected
setInterval(() => {
  if (isBleConnected) {
    sendCommand({ cmd: 'status' });
  }
}, 3500);
