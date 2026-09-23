/**
 * ==============================================================================
 * SMART CLASSROOM AUTOMATION SYSTEM - DUAL ZONE CONTROLLER
 * Project: NBA Smart Classroom App (NBA_SCR_App)
 * Target: ESP32 Development Board (ESP32-WROOM-32)
 *
 * Capabilities:
 * - Controls 2 Classrooms (A101 & A102) + Corridor zones from a single ESP32
 * - Non-blocking sensor polling (DHT11, Dual PIR with hold timer, Dual LDRs)
 * - 6-Channel Relay Control with Active-LOW/HIGH support
 * - Dual Servo Curtain drive with smooth non-blocking sweep & jitter prevention
 * - I2C 128x64 OLED Live Telemetry Monitor
 * - Dual-layer REST API (Legacy backward-compatible + Enhanced App JSON)
 * - Embedded Mobile-Responsive Dark Web Dashboard for instant browser testing
 * - mDNS responder (http://esp32-classroom.local) & Wi-Fi auto-reconnect
 * ==============================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <ESPmDNS.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <ESP32Servo.h>

#include "config.h"

// ==========================================
// --- HARDWARE INSTANCES ---
// ==========================================
WebServer server(WEB_SERVER_PORT);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET_PIN);
DHT dht(DHTPIN, DHTTYPE);
Servo curtain1;
Servo curtain2;

// ==========================================
// --- SYSTEM STATE & THRESHOLDS ---
// ==========================================
volatile bool isAutoMode = false; // Default to manual mode so mobile app controls relays reliably

float currentTempThreshold    = DEFAULT_TEMP_THRESHOLD;
int   currentLdrThreshold     = DEFAULT_LDR_THRESHOLD;
unsigned long currentHoldTime = OCCUPANCY_HOLD_MS;

// Shared Sensors
volatile float currentTemp = 24.0;
volatile float currentHum  = 50.0;
volatile int   ldr1_value  = 0;
volatile int   ldr2_value  = 0;

// Classroom 1 (A101) State
volatile bool pir1_active          = false;
volatile bool c1_occupied          = false;
volatile unsigned long c1_last_motion = 0;
volatile bool state_c1_light       = false;
volatile bool state_c1_fan         = false;
volatile bool state_c1_curtain     = false;
int  current_c1_angle     = SERVO_CLOSED_ANGLE;
int  target_c1_angle      = SERVO_CLOSED_ANGLE;
unsigned long last_servo1_move = 0;
bool servo1_attached      = false;

// Classroom 2 (A102) State
volatile bool pir2_active          = false;
volatile bool c2_occupied          = false;
volatile unsigned long c2_last_motion = 0;
volatile bool state_c2_light       = false;
volatile bool state_c2_fan         = false;
volatile bool state_c2_curtain     = false;
int  current_c2_angle     = SERVO_CLOSED_ANGLE;
int  target_c2_angle      = SERVO_CLOSED_ANGLE;
unsigned long last_servo2_move = 0;
bool servo2_attached      = false;

// Corridor States
volatile bool state_corr1_light = false;
volatile bool state_corr2_light = false;

// Cloud State Tracking (Prevents stale DB polls from overriding local sensor actions)
bool cloud_initialized      = false;
bool cloud_prev_c1_light    = false;
bool cloud_prev_c1_fan      = false;
bool cloud_prev_c1_curtain  = false;
bool cloud_prev_c2_light    = false;
bool cloud_prev_c2_fan      = false;
bool cloud_prev_c2_curtain  = false;
bool cloud_prev_corr1_light = false;
bool cloud_prev_corr2_light = false;
volatile bool pendingModeCloudSync = false;

// OLED Hardware flag
bool oledFound = false;

// ==========================================
// --- POWER TELEMETRY HELPERS ---
// ==========================================
float getC1LoadWatts() {
  float w = 0.0;
  if (state_c1_light)   w += WATTS_CLASS_LIGHT;
  if (state_c1_fan)     w += WATTS_CLASS_FAN;
  if (state_c1_curtain) w += WATTS_SERVO_ACTIVE;
  return w;
}

float getC2LoadWatts() {
  float w = 0.0;
  if (state_c2_light)   w += WATTS_CLASS_LIGHT;
  if (state_c2_fan)     w += WATTS_CLASS_FAN;
  if (state_c2_curtain) w += WATTS_SERVO_ACTIVE;
  return w;
}

float getTotalLoadWatts() {
  float w = getC1LoadWatts() + getC2LoadWatts();
  if (state_corr1_light) w += WATTS_CORR_LIGHT;
  if (state_corr2_light) w += WATTS_CORR_LIGHT;
  return w;
}

float getCorrLoadWatts() {
  float w = 0.0;
  if (state_corr1_light) w += WATTS_CORR_LIGHT;
  if (state_corr2_light) w += WATTS_CORR_LIGHT;
  return w;
}

// ==========================================
// --- SERVO HARDWARE CONTROL ---
// ==========================================
void updateServos() {
  unsigned long now = millis();

  // Target angles based on curtain states
  target_c1_angle = state_c1_curtain ? SERVO_OPEN_ANGLE : SERVO_CLOSED_ANGLE;
  target_c2_angle = state_c2_curtain ? SERVO_OPEN_ANGLE : SERVO_CLOSED_ANGLE;

  // Servo 1 (Classroom 1)
  if (current_c1_angle != target_c1_angle) {
    if (!servo1_attached) {
      curtain1.attach(SERVO1_PIN);
      servo1_attached = true;
    }
    if (now - last_servo1_move >= SERVO_SPEED_MS) {
      last_servo1_move = now;
      if (current_c1_angle < target_c1_angle) current_c1_angle++;
      else current_c1_angle--;
      curtain1.write(current_c1_angle);
    }
  } else {
    // Detach after sitting idle to eliminate servo hum and save power
    if (servo1_attached && (now - last_servo1_move > SERVO_IDLE_DETACH)) {
      curtain1.detach();
      servo1_attached = false;
    }
  }

  // Servo 2 (Classroom 2)
  if (current_c2_angle != target_c2_angle) {
    if (!servo2_attached) {
      curtain2.attach(SERVO2_PIN);
      servo2_attached = true;
    }
    if (now - last_servo2_move >= SERVO_SPEED_MS) {
      last_servo2_move = now;
      if (current_c2_angle < target_c2_angle) current_c2_angle++;
      else current_c2_angle--;
      curtain2.write(current_c2_angle);
    }
  } else {
    if (servo2_attached && (now - last_servo2_move > SERVO_IDLE_DETACH)) {
      curtain2.detach();
      servo2_attached = false;
    }
  }
}

// ==========================================
// --- PHYSICAL RELAY SYNCHRONIZATION ---
// ==========================================
void applyRelayStates() {
  digitalWrite(RELAY_CLASS_LIGHT1,    state_c1_light    ? RELAY_ON : RELAY_OFF);
  digitalWrite(RELAY_CLASS_FAN1,      state_c1_fan      ? RELAY_ON : RELAY_OFF);
  digitalWrite(RELAY_CLASS_LIGHT2,    state_c2_light    ? RELAY_ON : RELAY_OFF);
  digitalWrite(RELAY_CLASS_FAN2,      state_c2_fan      ? RELAY_ON : RELAY_OFF);
  digitalWrite(RELAY_CORRIDOR_LIGHT1, state_corr1_light ? RELAY_ON : RELAY_OFF);
  digitalWrite(RELAY_CORRIDOR_LIGHT2, state_corr2_light ? RELAY_ON : RELAY_OFF);
}

// ==========================================
// --- HTTP / CORS HELPERS ---
// ==========================================
void enableCORS() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
}

void handleOptions() {
  enableCORS();
  server.send(204);
}

// ==========================================
// --- REST API: STATUS ---
// ==========================================
// Generates status JSON (100% backward compatible with original code + app fields)
String buildStatusJson(bool includeTelemetry = true) {
  String json = "{";
  json += "\"status\":\"ok\",";
  json += "\"mode\":\"" + String(isAutoMode ? "auto" : "manual") + "\",";
  json += "\"temperature\":" + String(currentTemp, 1) + ",";
  json += "\"humidity\":" + String(currentHum, 1) + ",";
  json += "\"total_load_watts\":" + String(getTotalLoadWatts(), 1) + ",";

  // Classroom 1 (cls-a101)
  json += "\"classroom1\":{";
  json += "\"id\":\"" + String(CLASSROOM_1_ID) + "\",";
  json += "\"name\":\"" + String(CLASSROOM_1_NAME) + "\",";
  json += "\"room\":\"" + String(CLASSROOM_1_NUM) + "\",";
  json += "\"motion\":" + String(pir1_active ? "true" : "false") + ",";
  json += "\"occupied\":" + String(c1_occupied ? "true" : "false") + ",";
  json += "\"light\":" + String(state_c1_light ? "true" : "false") + ",";
  json += "\"fan\":" + String(state_c1_fan ? "true" : "false") + ",";
  json += "\"curtain\":" + String(state_c1_curtain ? "true" : "false") + ",";
  json += "\"curtain_angle\":" + String(current_c1_angle) + ",";
  json += "\"load_watts\":" + String(getC1LoadWatts(), 1);
  json += "},";

  // Classroom 2 (cls-a102)
  json += "\"classroom2\":{";
  json += "\"id\":\"" + String(CLASSROOM_2_ID) + "\",";
  json += "\"name\":\"" + String(CLASSROOM_2_NAME) + "\",";
  json += "\"room\":\"" + String(CLASSROOM_2_NUM) + "\",";
  json += "\"motion\":" + String(pir2_active ? "true" : "false") + ",";
  json += "\"occupied\":" + String(c2_occupied ? "true" : "false") + ",";
  json += "\"light\":" + String(state_c2_light ? "true" : "false") + ",";
  json += "\"fan\":" + String(state_c2_fan ? "true" : "false") + ",";
  json += "\"curtain\":" + String(state_c2_curtain ? "true" : "false") + ",";
  json += "\"curtain_angle\":" + String(current_c2_angle) + ",";
  json += "\"load_watts\":" + String(getC2LoadWatts(), 1);
  json += "},";

  // Corridors
  json += "\"corridors\":{";
  json += "\"ldr1_raw\":" + String(ldr1_value) + ",";
  json += "\"light1\":" + String(state_corr1_light ? "true" : "false") + ",";
  json += "\"ldr2_raw\":" + String(ldr2_value) + ",";
  json += "\"light2\":" + String(state_corr2_light ? "true" : "false");
  json += "}";

  if (includeTelemetry) {
    json += ",\"controller\":{";
    json += "\"firmware\":\"" + String(FIRMWARE_VERSION) + "\",";
    json += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
    json += "\"rssi\":" + String(WiFi.RSSI()) + ",";
    json += "\"uptime_sec\":" + String(millis() / 1000) + ",";
    json += "\"free_heap\":" + String(ESP.getFreeHeap());
    json += "}";
  }

  json += "}";
  return json;
}

void handleStatus() {
  enableCORS();
  server.send(200, "application/json", buildStatusJson(true));
}

// ==========================================
// --- REST API: MODE ---
// ==========================================
void handleMode() {
  enableCORS();
  bool prevAuto = isAutoMode;
  if (server.hasArg("auto")) {
    isAutoMode = (server.arg("auto") == "1" || server.arg("auto") == "true");
  } else if (server.hasArg("plain")) {
    String body = server.arg("plain");
    if (body.indexOf("\"auto\":true") >= 0 || body.indexOf("\"auto\":1") >= 0) isAutoMode = true;
    else if (body.indexOf("\"auto\":false") >= 0 || body.indexOf("\"auto\":0") >= 0) isAutoMode = false;
  }
  if (isAutoMode != prevAuto) {
    pendingModeCloudSync = true;
    Serial.printf("[SYSTEM] Mode changed via Local API -> %s\n", isAutoMode ? "AUTO" : "MANUAL");
  }
  server.send(200, "application/json", "{\"status\":\"ok\",\"mode\":\"" + String(isAutoMode ? "auto" : "manual") + "\"}");
}

// ==========================================
// --- REST API: CONTROL ---
// ==========================================
// Supports legacy query params (dev=l1&st=1) AND modern app device IDs
void applyDeviceControl(String dev, bool st) {
  dev.toLowerCase();
  
  // Classroom 1 / A101
  if (dev == "l1" || dev == "light1" || dev == "dev-a101-light" || dev == "dev-a101-light-1" || dev == "dev-a101-light-2") {
    state_c1_light = st;
  } else if (dev == "f1" || dev == "fan1" || dev == "dev-a101-fan" || dev == "dev-a101-fan-1" || dev == "dev-a101-fan-2") {
    state_c1_fan = st;
  } else if (dev == "c1" || dev == "curtain1" || dev == "dev-a101-curtain") {
    state_c1_curtain = st;
  }
  // Classroom 2 / A102
  else if (dev == "l2" || dev == "light2" || dev == "dev-a102-light" || dev == "dev-a102-light-1" || dev == "dev-a102-light-2") {
    state_c2_light = st;
  } else if (dev == "f2" || dev == "fan2" || dev == "dev-a102-fan" || dev == "dev-a102-fan-1" || dev == "dev-a102-fan-2") {
    state_c2_fan = st;
  } else if (dev == "c2" || dev == "curtain2" || dev == "dev-a102-curtain") {
    state_c2_curtain = st;
  }
  // Corridors
  else if (dev == "cr1" || dev == "corridor1" || dev == "corr1" || dev == "dev-corr-light1" || dev == "dev-corr-light-1") {
    state_corr1_light = st;
  } else if (dev == "cr2" || dev == "corridor2" || dev == "corr2" || dev == "dev-corr-light2" || dev == "dev-corr-light-2") {
    state_corr2_light = st;
  }
  // Bulk / Emergency Commands
  else if (dev == "all" || dev == "emergency") {
    state_c1_light    = st;
    state_c1_fan      = st;
    state_c1_curtain  = st;
    state_c2_light    = st;
    state_c2_fan      = st;
    state_c2_curtain  = st;
    state_corr1_light = st;
    state_corr2_light = st;
  }

  // Instantly apply relay pin states
  applyRelayStates();
}

void handleControl() {
  enableCORS();

  // Any incoming manual control command immediately switches to manual override mode
  if (isAutoMode) {
    isAutoMode = false;
    pendingModeCloudSync = true;
    Serial.println(F("[SYSTEM] Manual command received -> Switched to MANUAL Mode"));
  }

  // Handle Query Parameters (GET /ctrl?dev=l1&st=1)
  if (server.hasArg("dev") && server.arg("st")) {
    String dev = server.arg("dev");
    bool st = (server.arg("st") == "1" || server.arg("st") == "true" || server.arg("st") == "on");
    applyDeviceControl(dev, st);
    server.send(200, "application/json", "{\"status\":\"ok\",\"device\":\"" + dev + "\",\"state\":" + String(st ? "true" : "false") + "}");
    return;
  }

  // Handle JSON POST Body (POST /api/control with {"dev":"l1","st":1})
  if (server.hasArg("plain")) {
    String body = server.arg("plain");
    String dev = "";
    bool st = false;

    // Fast parser for {"dev":"...", "st":...} or {"deviceId":"...", "state":"..."}
    int devIdx = body.indexOf("\"dev\":\"");
    if (devIdx < 0) devIdx = body.indexOf("\"deviceId\":\"");
    if (devIdx >= 0) {
      int start = body.indexOf("\"", devIdx + 6) + 1;
      int end = body.indexOf("\"", start);
      dev = body.substring(start, end);
    }

    if (body.indexOf("\"st\":1") >= 0 || body.indexOf("\"st\":true") >= 0 || 
        body.indexOf("\"state\":true") >= 0 || body.indexOf("\"state\":\"on\"") >= 0) {
      st = true;
    }

    if (dev.length() > 0) {
      applyDeviceControl(dev, st);
      server.send(200, "application/json", "{\"status\":\"ok\",\"device\":\"" + dev + "\",\"state\":" + String(st ? "true" : "false") + "}");
      return;
    }
  }

  server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"Missing 'dev' and 'st' parameters\"}");
}

// ==========================================
// --- REST API: CONFIGURATION ---
// ==========================================
void handleConfig() {
  enableCORS();
  if (server.hasArg("temp_thresh")) {
    currentTempThreshold = server.arg("temp_thresh").toFloat();
  }
  if (server.hasArg("ldr_thresh")) {
    currentLdrThreshold = server.arg("ldr_thresh").toInt();
  }
  if (server.hasArg("hold_sec")) {
    currentHoldTime = server.arg("hold_sec").toInt() * 1000UL;
  }

  String json = "{";
  json += "\"status\":\"ok\",";
  json += "\"temp_threshold\":" + String(currentTempThreshold, 1) + ",";
  json += "\"ldr_threshold\":" + String(currentLdrThreshold) + ",";
  json += "\"hold_time_ms\":" + String(currentHoldTime);
  json += "}";
  server.send(200, "application/json", json);
}

// ==========================================
// --- EMBEDDED WEB DASHBOARD (MOBILE-READY) ---
// ==========================================
// Serves responsive web control center matching the mobile app palette
const char PAGE_INDEX[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Smart Classroom IoT Controller</title>
  <style>
    :root {
      --bg: #080908;
      --card: #151615;
      --card-border: #262826;
      --primary: #FDA83A;
      --text: #F3F4F6;
      --text-muted: #9CA3AF;
      --success: #22C55E;
      --danger: #EF4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background-color: var(--bg); color: var(--text); padding: 16px; max-width: 600px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; padding: 12px 0 20px; border-bottom: 1px solid var(--card-border); margin-bottom: 20px; }
    h1 { font-size: 20px; font-weight: 700; color: var(--primary); }
    .badge { padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; cursor: pointer; }
    .badge-auto { background: rgba(34, 197, 94, 0.15); color: var(--success); border: 1px solid var(--success); }
    .badge-manual { background: rgba(253, 168, 58, 0.15); color: var(--primary); border: 1px solid var(--primary); }
    
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
    .stat-card { background: var(--card); border: 1px solid var(--card-border); border-radius: 16px; padding: 12px; text-align: center; }
    .stat-val { font-size: 20px; font-weight: 700; color: var(--primary); margin-top: 4px; }
    .stat-lbl { font-size: 11px; color: var(--text-muted); text-transform: uppercase; }

    .room-card { background: var(--card); border: 1px solid var(--card-border); border-radius: 20px; padding: 16px; margin-bottom: 16px; }
    .room-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .room-title { font-size: 16px; font-weight: 600; }
    .occ-pill { font-size: 11px; padding: 3px 8px; border-radius: 12px; font-weight: 600; }
    .occ-occupied { background: rgba(34, 197, 94, 0.2); color: var(--success); }
    .occ-vacant { background: rgba(156, 163, 175, 0.2); color: var(--text-muted); }

    .ctrl-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.05); }
    .ctrl-label { font-size: 14px; color: var(--text); }
    .toggle { position: relative; display: inline-block; width: 48px; height: 26px; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #2b2b2b; transition: .3s; border-radius: 26px; }
    .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
    input:checked + .slider { background-color: var(--primary); }
    input:checked + .slider:before { transform: translateX(22px); }

    .btn-emergency { width: 100%; background: rgba(239, 68, 68, 0.15); border: 1px solid var(--danger); color: var(--danger); padding: 12px; border-radius: 14px; font-weight: 700; cursor: pointer; margin-top: 10px; }
    .btn-emergency:hover { background: var(--danger); color: white; }
    .footer { text-align: center; font-size: 11px; color: var(--text-muted); margin-top: 24px; padding-bottom: 12px; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>NBA Smart Classroom</h1>
      <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Dual Zone Controller (ESP32)</div>
    </div>
    <div id="modeBtn" class="badge badge-auto" onclick="toggleMode()">AUTO</div>
  </header>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-lbl">Temp</div>
      <div class="stat-val" id="tempVal">--.-°C</div>
    </div>
    <div class="stat-card">
      <div class="stat-lbl">Humidity</div>
      <div class="stat-val" id="humVal">--%</div>
    </div>
    <div class="stat-card">
      <div class="stat-lbl">Load</div>
      <div class="stat-val" id="loadVal">-- W</div>
    </div>
  </div>

  <!-- Classroom 1 -->
  <div class="room-card">
    <div class="room-header">
      <div class="room-title">Classroom A101</div>
      <span class="occ-pill occ-vacant" id="c1Occ">VACANT</span>
    </div>
    <div class="ctrl-row">
      <span class="ctrl-label">Main Lights</span>
      <label class="toggle"><input type="checkbox" id="l1" onchange="ctrl('l1', this.checked)"><span class="slider"></span></label>
    </div>
    <div class="ctrl-row">
      <span class="ctrl-label">Ceiling Fan</span>
      <label class="toggle"><input type="checkbox" id="f1" onchange="ctrl('f1', this.checked)"><span class="slider"></span></label>
    </div>
    <div class="ctrl-row">
      <span class="ctrl-label">Curtain (Servo 1)</span>
      <label class="toggle"><input type="checkbox" id="c1" onchange="ctrl('c1', this.checked)"><span class="slider"></span></label>
    </div>
  </div>

  <!-- Classroom 2 -->
  <div class="room-card">
    <div class="room-header">
      <div class="room-title">Classroom A102</div>
      <span class="occ-pill occ-vacant" id="c2Occ">VACANT</span>
    </div>
    <div class="ctrl-row">
      <span class="ctrl-label">Main Lights</span>
      <label class="toggle"><input type="checkbox" id="l2" onchange="ctrl('l2', this.checked)"><span class="slider"></span></label>
    </div>
    <div class="ctrl-row">
      <span class="ctrl-label">Ceiling Fan</span>
      <label class="toggle"><input type="checkbox" id="f2" onchange="ctrl('f2', this.checked)"><span class="slider"></span></label>
    </div>
    <div class="ctrl-row">
      <span class="ctrl-label">Curtain (Servo 2)</span>
      <label class="toggle"><input type="checkbox" id="c2" onchange="ctrl('c2', this.checked)"><span class="slider"></span></label>
    </div>
  </div>

  <!-- Corridors -->
  <div class="room-card">
    <div class="room-header">
      <div class="room-title">Corridor Lighting</div>
      <span style="font-size: 12px; color: var(--text-muted);" id="ldrVal">LDR: --</span>
    </div>
    <div class="ctrl-row">
      <span class="ctrl-label">Corridor Light 1</span>
      <label class="toggle"><input type="checkbox" id="cr1" onchange="ctrl('cr1', this.checked)"><span class="slider"></span></label>
    </div>
    <div class="ctrl-row">
      <span class="ctrl-label">Corridor Light 2</span>
      <label class="toggle"><input type="checkbox" id="cr2" onchange="ctrl('cr2', this.checked)"><span class="slider"></span></label>
    </div>
  </div>

  <button class="btn-emergency" onclick="emergencyOff()">EMERGENCY ALL OFF</button>
  <div class="footer" id="footerInfo">Connecting to ESP32...</div>

  <script>
    let currentMode = 'auto';

    async function poll() {
      try {
        const res = await fetch('/status');
        const data = await res.json();
        
        currentMode = data.mode;
        const mb = document.getElementById('modeBtn');
        mb.innerText = currentMode.toUpperCase();
        mb.className = 'badge ' + (currentMode === 'auto' ? 'badge-auto' : 'badge-manual');

        document.getElementById('tempVal').innerText = data.temperature.toFixed(1) + '°C';
        document.getElementById('humVal').innerText = Math.round(data.humidity) + '%';
        document.getElementById('loadVal').innerText = Math.round(data.total_load_watts) + ' W';

        // C1
        document.getElementById('c1Occ').innerText = data.classroom1.occupied ? 'OCCUPIED' : 'VACANT';
        document.getElementById('c1Occ').className = 'occ-pill ' + (data.classroom1.occupied ? 'occ-occupied' : 'occ-vacant');
        document.getElementById('l1').checked = data.classroom1.light;
        document.getElementById('f1').checked = data.classroom1.fan;
        document.getElementById('c1').checked = data.classroom1.curtain;

        // C2
        document.getElementById('c2Occ').innerText = data.classroom2.occupied ? 'OCCUPIED' : 'VACANT';
        document.getElementById('c2Occ').className = 'occ-pill ' + (data.classroom2.occupied ? 'occ-occupied' : 'occ-vacant');
        document.getElementById('l2').checked = data.classroom2.light;
        document.getElementById('f2').checked = data.classroom2.fan;
        document.getElementById('c2').checked = data.classroom2.curtain;

        // Corridors
        document.getElementById('cr1').checked = data.corridors.light1;
        document.getElementById('cr2').checked = data.corridors.light2;
        document.getElementById('ldrVal').innerText = 'LDR1: ' + data.corridors.ldr1_raw + ' | LDR2: ' + data.corridors.ldr2_raw;

        if (data.controller) {
          document.getElementById('footerInfo').innerText = 'IP: ' + data.controller.ip + ' | RSSI: ' + data.controller.rssi + ' dBm | FW: v' + data.controller.firmware;
        }
      } catch (e) {
        document.getElementById('footerInfo').innerText = 'Connection lost. Reconnecting...';
      }
    }

    async function ctrl(dev, state) {
      await fetch('/ctrl?dev=' + dev + '&st=' + (state ? 1 : 0) + '&force=1');
      poll();
    }

    async function toggleMode() {
      const target = currentMode === 'auto' ? 0 : 1;
      await fetch('/mode?auto=' + target);
      poll();
    }

    async function emergencyOff() {
      await fetch('/ctrl?dev=all&st=0&force=1');
      poll();
    }

    setInterval(poll, 1500);
    poll();
  </script>
</body>
</html>
)rawliteral";

void handleRoot() {
  server.send_P(200, "text/html", PAGE_INDEX);
}

// Forward declaration for FreeRTOS background cloud task
void supabaseCloudTask(void* pvParameters);

// ==========================================
// --- SETUP INITIALIZATION ---
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println(F("\n=============================================="));
  Serial.println(F(" NBA SMART CLASSROOM - DUAL ZONE CONTROLLER"));
  Serial.printf(F(" Firmware Version: %s\n"), FIRMWARE_VERSION);
  Serial.println(F("=============================================="));

  // 1. Initialize Sensor Pins
  dht.begin();
  pinMode(PIR1_PIN, INPUT_PULLDOWN);
  pinMode(PIR2_PIN, INPUT_PULLDOWN);
  pinMode(LDR_CORRIDOR1_PIN, INPUT);
  pinMode(LDR_CORRIDOR2_PIN, INPUT);

  // 2. Initialize Relay Output Pins
  pinMode(RELAY_CLASS_LIGHT1, OUTPUT);
  pinMode(RELAY_CLASS_FAN1, OUTPUT);
  pinMode(RELAY_CLASS_LIGHT2, OUTPUT);
  pinMode(RELAY_CLASS_FAN2, OUTPUT);
  pinMode(RELAY_CORRIDOR_LIGHT1, OUTPUT);
  pinMode(RELAY_CORRIDOR_LIGHT2, OUTPUT);

  // Start with all relays explicitly in safe OFF state
  applyRelayStates();

  // 3. Initialize Servos (Closed position)
  curtain1.setPeriodHertz(50);
  curtain2.setPeriodHertz(50);
  curtain1.attach(SERVO1_PIN);
  curtain2.attach(SERVO2_PIN);
  curtain1.write(SERVO_CLOSED_ANGLE);
  curtain2.write(SERVO_CLOSED_ANGLE);
  delay(400);
  curtain1.detach();
  curtain2.detach();

  // 4. Initialize I2C OLED Display
  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
  if (display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
    oledFound = true;
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println(F("NBA Smart Classroom"));
    display.println(F("Dual Controller"));
    display.println(F("---------------------"));
    display.println(F("Connecting Wi-Fi..."));
    display.display();
  } else {
    Serial.println(F("[WARN] OLED SSD1306 allocation failed (check SDA/SCL pins)"));
  }

  // 5. Connect to Wi-Fi
  Serial.printf("Connecting to Wi-Fi SSID: %s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startWifi = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startWifi < 15000) {
    delay(400);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(F("\n[OK] Wi-Fi Connected!"));
    Serial.printf("IP Address: %s\n", WiFi.localIP().toString().c_str());

    // 6. Start mDNS Responder (http://esp32-classroom.local)
    if (MDNS.begin(HOSTNAME)) {
      Serial.printf("mDNS Responder live at: http://%s.local\n", HOSTNAME);
      MDNS.addService("http", "tcp", WEB_SERVER_PORT);
    }
  } else {
    Serial.println(F("\n[WARN] Wi-Fi connection timed out. Starting offline demo mode."));
  }

  // 7. Update OLED with IP
  if (oledFound) {
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println(F("NBA IoT Controller"));
    display.println(F("---------------------"));
    if (WiFi.status() == WL_CONNECTED) {
      display.println(F("Wi-Fi: Connected"));
      display.println(WiFi.localIP());
    } else {
      display.println(F("Wi-Fi: OFFLINE"));
    }
    display.display();
    delay(2000);
  }

  // 8. Register REST API Handlers
  server.on("/", HTTP_GET, handleRoot);              // Web dashboard
  server.on("/web", HTTP_GET, handleRoot);
  server.on("/status", HTTP_GET, handleStatus);      // Backward compatible status
  server.on("/api/status", HTTP_GET, handleStatus);  // Enhanced REST status
  server.on("/mode", HTTP_GET, handleMode);          // Mode toggle
  server.on("/api/mode", HTTP_ANY, handleMode);
  server.on("/ctrl", HTTP_GET, handleControl);       // Device control
  server.on("/api/control", HTTP_ANY, handleControl);
  server.on("/config", HTTP_GET, handleConfig);      // Threshold adjustments
  server.on("/api/config", HTTP_ANY, handleConfig);

  server.onNotFound(handleOptions);                  // Handle CORS preflight & 404s
  server.begin();
  Serial.println(F("[OK] HTTP API Server Started"));

  // 9. Launch Supabase Cloud Task on Core 0 (Background)
  // 16KB stack space ensures safe mbedTLS execution without stack overflow
  xTaskCreatePinnedToCore(
    supabaseCloudTask,
    "SupabaseCloudTask",
    16384,
    NULL,
    1,
    NULL,
    0
  );
  Serial.println(F("[OK] Supabase Cloud Background Task started on Core 0"));
}

// ==========================================
// --- SUPABASE CLOUD SYNCHRONIZATION ---
// ==========================================
unsigned long lastSupabasePoll = 0;
unsigned long lastSupabaseTelemetry = 0;
bool supabaseSyncActive = false;

void syncWithSupabase() {
  if (WiFi.status() != WL_CONNECTED) return;
  unsigned long now = millis();

  // 0. Sync System Mode to Cloud if changed locally
  if (pendingModeCloudSync) {
    pendingModeCloudSync = false;
    WiFiClientSecure mClient;
    mClient.setInsecure();
    mClient.setTimeout(5000);
    HTTPClient mHttps;
    mHttps.setTimeout(5000);
    String urlMode = String(SUPABASE_URL) + "/rest/v1/devices?id=eq.dev-system-mode";
    if (mHttps.begin(mClient, urlMode)) {
      mHttps.addHeader("apikey", SUPABASE_KEY);
      mHttps.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
      mHttps.addHeader("Content-Type", "application/json");
      mHttps.addHeader("Prefer", "return=minimal");
      String body = "{\"status\":\"" + String(isAutoMode ? "auto" : "manual") + "\"}";
      mHttps.sendRequest("PATCH", body);
      mHttps.end();
      mClient.stop();
    }
  }

  // 1. Fetch Remote Device Commands from Supabase (Every 1000ms)
  if (now - lastSupabasePoll >= SUPABASE_POLL_INTERVAL_MS) {
    lastSupabasePoll = now;

    WiFiClientSecure client;
    client.setInsecure();    // Supabase HTTPS
    client.setTimeout(5000); // 5000ms socket timeout (allows TLS handshake over Internet)

    HTTPClient https;
    https.setTimeout(5000);
    String url = String(SUPABASE_URL) + "/rest/v1/devices?select=id,status";
    if (https.begin(client, url)) {
      https.addHeader("apikey", SUPABASE_KEY);
      https.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
      https.addHeader("Accept", "application/json");

      int httpCode = https.GET();
      if (httpCode == 200) {
        supabaseSyncActive = true;
        String payload = https.getString();

        StaticJsonDocument<1536> doc;
        DeserializationError err = deserializeJson(doc, payload);
        if (!err && doc.is<JsonArray>()) {
          bool anyStateChanged = false;
          for (JsonObject dev : doc.as<JsonArray>()) {
            const char* id = dev["id"];
            const char* st = dev["status"];
            if (!id || !st) continue;

            // 1. System Mode command from Cloud
            if (strcmp(id, "dev-system-mode") == 0) {
              bool cloudAuto = (strcmp(st, "auto") == 0);
              if (isAutoMode != cloudAuto) {
                isAutoMode = cloudAuto;
                Serial.printf("[SYSTEM] Mode changed via Cloud -> %s\n", isAutoMode ? "AUTO" : "MANUAL");
              }
              continue;
            }

            bool isOn = (strcmp(st, "on") == 0);

            // On first boot, record baseline cloud states without triggering actions
            if (!cloud_initialized) {
              if (strcmp(id, "dev-a101-light-1") == 0 || strcmp(id, "dev-a101-light") == 0) cloud_prev_c1_light = isOn;
              else if (strcmp(id, "dev-a101-fan-1") == 0 || strcmp(id, "dev-a101-fan") == 0) cloud_prev_c1_fan = isOn;
              else if (strcmp(id, "dev-a101-curtain") == 0) cloud_prev_c1_curtain = isOn;
              else if (strcmp(id, "dev-a102-light-1") == 0 || strcmp(id, "dev-a102-light") == 0) cloud_prev_c2_light = isOn;
              else if (strcmp(id, "dev-a102-fan-1") == 0 || strcmp(id, "dev-a102-fan") == 0) cloud_prev_c2_fan = isOn;
              else if (strcmp(id, "dev-a102-curtain") == 0) cloud_prev_c2_curtain = isOn;
              else if (strcmp(id, "dev-corr-light-1") == 0 || strcmp(id, "dev-corr-light1") == 0) cloud_prev_corr1_light = isOn;
              else if (strcmp(id, "dev-corr-light-2") == 0 || strcmp(id, "dev-corr-light2") == 0) cloud_prev_corr2_light = isOn;
              continue;
            }

            // Differential Tracking: Only act if cloud state actually changed (isOn != cloud_prev_*)
            // This prevents stale database rows from overriding local PIR/LDR sensor decisions!
            if (strcmp(id, "dev-a101-light-1") == 0 || strcmp(id, "dev-a101-light") == 0) {
              if (isOn != cloud_prev_c1_light) {
                cloud_prev_c1_light = isOn;
                state_c1_light = isOn;
                anyStateChanged = true;
                Serial.printf("[MANUAL OVERRIDE] A101 Light -> %s\n", isOn ? "ON" : "OFF");
              }
            } else if (strcmp(id, "dev-a101-fan-1") == 0 || strcmp(id, "dev-a101-fan") == 0) {
              if (isOn != cloud_prev_c1_fan) {
                cloud_prev_c1_fan = isOn;
                state_c1_fan = isOn;
                anyStateChanged = true;
                Serial.printf("[MANUAL OVERRIDE] A101 Fan -> %s\n", isOn ? "ON" : "OFF");
              }
            } else if (strcmp(id, "dev-a101-curtain") == 0) {
              if (isOn != cloud_prev_c1_curtain) {
                cloud_prev_c1_curtain = isOn;
                state_c1_curtain = isOn;
                anyStateChanged = true;
                Serial.printf("[MANUAL OVERRIDE] A101 Curtain -> %s\n", isOn ? "OPEN" : "CLOSED");
              }
            } else if (strcmp(id, "dev-a102-light-1") == 0 || strcmp(id, "dev-a102-light") == 0) {
              if (isOn != cloud_prev_c2_light) {
                cloud_prev_c2_light = isOn;
                state_c2_light = isOn;
                anyStateChanged = true;
                Serial.printf("[MANUAL OVERRIDE] A102 Light -> %s\n", isOn ? "ON" : "OFF");
              }
            } else if (strcmp(id, "dev-a102-fan-1") == 0 || strcmp(id, "dev-a102-fan") == 0) {
              if (isOn != cloud_prev_c2_fan) {
                cloud_prev_c2_fan = isOn;
                state_c2_fan = isOn;
                anyStateChanged = true;
                Serial.printf("[MANUAL OVERRIDE] A102 Fan -> %s\n", isOn ? "ON" : "OFF");
              }
            } else if (strcmp(id, "dev-a102-curtain") == 0) {
              if (isOn != cloud_prev_c2_curtain) {
                cloud_prev_c2_curtain = isOn;
                state_c2_curtain = isOn;
                anyStateChanged = true;
                Serial.printf("[MANUAL OVERRIDE] A102 Curtain -> %s\n", isOn ? "OPEN" : "CLOSED");
              }
            } else if (strcmp(id, "dev-corr-light-1") == 0 || strcmp(id, "dev-corr-light1") == 0) {
              if (isOn != cloud_prev_corr1_light) {
                cloud_prev_corr1_light = isOn;
                state_corr1_light = isOn;
                anyStateChanged = true;
                Serial.printf("[MANUAL OVERRIDE] Corridor 1 Light -> %s\n", isOn ? "ON" : "OFF");
              }
            } else if (strcmp(id, "dev-corr-light-2") == 0 || strcmp(id, "dev-corr-light2") == 0) {
              if (isOn != cloud_prev_corr2_light) {
                cloud_prev_corr2_light = isOn;
                state_corr2_light = isOn;
                anyStateChanged = true;
                Serial.printf("[MANUAL OVERRIDE] Corridor 2 Light -> %s\n", isOn ? "ON" : "OFF");
              }
            }
          }

          if (!cloud_initialized) cloud_initialized = true;

          if (anyStateChanged) {
            isAutoMode = false; // Disarm auto mode upon intentional manual command
            pendingModeCloudSync = true;
            applyRelayStates();
          }
        }
      } else {
        supabaseSyncActive = false;
        static unsigned long lastErr = 0;
        if (millis() - lastErr > 6000) {
          Serial.printf("[SUPABASE ERROR] GET devices HTTP %d: %s\n", httpCode, https.errorToString(httpCode).c_str());
          lastErr = millis();
        }
      }
      https.end();
      client.stop();
    }
  }

  // 2. Push Sensor & Occupancy Telemetry to Supabase (Alternate cycle - prevents TLS memory collision)
  else if (now - lastSupabaseTelemetry >= SUPABASE_TELEMETRY_INTERVAL_MS) {
    lastSupabaseTelemetry = now;
    static int telemetryStep = 0;

    WiFiClientSecure client;
    client.setInsecure();
    client.setTimeout(5000);
    HTTPClient https;
    https.setTimeout(5000);

    if (telemetryStep == 0) {
      // Slot 0: Classroom A101 Telemetry
      String urlA101 = String(SUPABASE_URL) + "/rest/v1/classrooms?id=eq.cls-a101";
      if (https.begin(client, urlA101)) {
        https.addHeader("apikey", SUPABASE_KEY);
        https.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
        https.addHeader("Content-Type", "application/json");
        https.addHeader("Prefer", "return=minimal");

        String body = "{\"temperature\":" + String(currentTemp, 1) + 
                      ",\"occupancy_status\":\"" + String(c1_occupied ? "occupied" : "vacant") + 
                      "\",\"current_load\":" + String(getC1LoadWatts(), 1) + 
                      ",\"status\":\"online\"}";
        https.sendRequest("PATCH", body);
        https.end();
        client.stop();
      }
    } else if (telemetryStep == 1) {
      // Slot 1: Classroom A102 Telemetry
      String urlA102 = String(SUPABASE_URL) + "/rest/v1/classrooms?id=eq.cls-a102";
      if (https.begin(client, urlA102)) {
        https.addHeader("apikey", SUPABASE_KEY);
        https.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
        https.addHeader("Content-Type", "application/json");
        https.addHeader("Prefer", "return=minimal");

        String body = "{\"temperature\":" + String(currentTemp, 1) + 
                      ",\"occupancy_status\":\"" + String(c2_occupied ? "occupied" : "vacant") + 
                      "\",\"current_load\":" + String(getC2LoadWatts(), 1) + 
                      ",\"status\":\"online\"}";
        https.sendRequest("PATCH", body);
        https.end();
        client.stop();
      }
    } else if (telemetryStep == 2) {
      // Slot 2: Corridors Telemetry
      String urlCorr = String(SUPABASE_URL) + "/rest/v1/classrooms?id=eq.cls-corridor";
      if (https.begin(client, urlCorr)) {
        https.addHeader("apikey", SUPABASE_KEY);
        https.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
        https.addHeader("Content-Type", "application/json");
        https.addHeader("Prefer", "return=minimal");

        String body = "{\"current_load\":" + String(getCorrLoadWatts(), 1) + ",\"status\":\"online\"}";
        https.sendRequest("PATCH", body);
        https.end();
        client.stop();
      }
    } else {
      // Slot 3: Controller Heartbeat & Live IP
      String urlCtrl = String(SUPABASE_URL) + "/rest/v1/controllers?id=eq.ctrl-esp32";
      if (https.begin(client, urlCtrl)) {
        https.addHeader("apikey", SUPABASE_KEY);
        https.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
        https.addHeader("Content-Type", "application/json");
        https.addHeader("Prefer", "return=minimal");

        int rssi = WiFi.RSSI();
        String sig = (rssi > -60) ? "strong" : (rssi > -75) ? "medium" : "weak";
        String body = "{\"status\":\"online\",\"signal_strength\":\"" + sig + 
                      "\",\"ip_address\":\"" + WiFi.localIP().toString() + 
                      "\",\"firmware_version\":\"" + String(FIRMWARE_VERSION) + "\"}";
        https.sendRequest("PATCH", body);
        https.end();
        client.stop();
      }
    }

    telemetryStep = (telemetryStep + 1) % 4;
  }
}

// Dedicated FreeRTOS background task running on Core 0
// Ensures cloud HTTPS polling NEVER blocks Core 1's local HTTP REST API / relay actuation!
void supabaseCloudTask(void* pvParameters) {
  vTaskDelay(pdMS_TO_TICKS(1500)); // Allow Wi-Fi to stabilize
  for (;;) {
    if (WiFi.status() == WL_CONNECTED && strlen(SUPABASE_URL) > 0 && strlen(SUPABASE_KEY) > 0) {
      syncWithSupabase();
    }
    vTaskDelay(pdMS_TO_TICKS(60)); // Yield to FreeRTOS scheduler
  }
}

// ==========================================
// --- MAIN RUNTIME LOOP ---
// ==========================================
void loop() {
  // 1. Process incoming HTTP client requests
  server.handleClient();

  // 2. Non-blocking DHT11 Environment Sampling
  static unsigned long lastDhtRead = 0;
  if (millis() - lastDhtRead >= DHT_READ_INTERVAL_MS) {
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t)) currentTemp = t;
    if (!isnan(h)) currentHum  = h;
    lastDhtRead = millis();
  }

  // 3. Sample PIR Motion & Corridor LDRs
  pir1_active = (digitalRead(PIR1_PIN) == HIGH);
  pir2_active = (digitalRead(PIR2_PIN) == HIGH);
  ldr1_value  = analogRead(LDR_CORRIDOR1_PIN);
  ldr2_value  = analogRead(LDR_CORRIDOR2_PIN);

  // 4. Classroom Occupancy State Machines (Debounced Hold Timer)
  unsigned long now = millis();

  // Classroom 1 Occupancy
  if (pir1_active) {
    c1_last_motion = now;
    c1_occupied = true;
  } else if (now - c1_last_motion >= currentHoldTime) {
    c1_occupied = false;
  }

  // Classroom 2 Occupancy
  if (pir2_active) {
    c2_last_motion = now;
    c2_occupied = true;
  } else if (now - c2_last_motion >= currentHoldTime) {
    c2_occupied = false;
  }

  // 5. Intelligent Automation Logic (Only active when isAutoMode == true)
  if (isAutoMode) {
    // Corridor Automation: Dark environment activates lights
    state_corr1_light = (ldr1_value > currentLdrThreshold);
    state_corr2_light = (ldr2_value > currentLdrThreshold);

    // Classroom 1 Automation
    if (c1_occupied) {
      state_c1_light   = true;
      state_c1_curtain = true;
      state_c1_fan     = (currentTemp > currentTempThreshold);
    } else {
      state_c1_light   = false;
      state_c1_curtain = false;
      state_c1_fan     = false;
    }

    // Classroom 2 Automation
    if (c2_occupied) {
      state_c2_light   = true;
      state_c2_curtain = true;
      state_c2_fan     = (currentTemp > currentTempThreshold);
    } else {
      state_c2_light   = false;
      state_c2_curtain = false;
      state_c2_fan     = false;
    }
  }

  // 6. Apply hardware relay outputs
  applyRelayStates();

  // 7. Non-blocking smooth servo sweep
  updateServos();

  // (Supabase Cloud Sync runs in background on Core 0 via supabaseCloudTask)

  // 8. OLED Display Refresh (Every 1000ms)
  static unsigned long lastDisplayUpdate = 0;
  if (oledFound && (now - lastDisplayUpdate >= OLED_REFRESH_MS)) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);

    // Line 1: IP & Mode
    display.print(F("IP:"));
    if (WiFi.status() == WL_CONNECTED) {
      display.print(WiFi.localIP());
    } else {
      display.print(F("OFFLINE"));
    }
    display.setCursor(92, 0);
    if (supabaseSyncActive) {
      display.println(isAutoMode ? F("CLD:A") : F("CLD:M"));
    } else {
      display.println(isAutoMode ? F("AUTO") : F("MANU"));
    }

    // Separator line
    display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

    // Line 2: Climate Telemetry
    display.setCursor(0, 14);
    display.printf("T:%.1fC  H:%.0f%%  %dW", currentTemp, currentHum, (int)getTotalLoadWatts());

    // Line 3: Classroom 1 Status
    display.setCursor(0, 26);
    display.print(F("C1:"));
    display.print(c1_occupied ? F("[OCC] ") : F("[VAC] "));
    display.print(state_c1_light ? F("L1 ") : F("L0 "));
    display.print(state_c1_fan   ? F("F1 ") : F("F0 "));
    display.print(state_c1_curtain ? F("C1") : F("C0"));

    // Line 4: Classroom 2 Status
    display.setCursor(0, 38);
    display.print(F("C2:"));
    display.print(c2_occupied ? F("[OCC] ") : F("[VAC] "));
    display.print(state_c2_light ? F("L1 ") : F("L0 "));
    display.print(state_c2_fan   ? F("F1 ") : F("F0 "));
    display.print(state_c2_curtain ? F("C1") : F("C0"));

    // Line 5: Corridors
    display.setCursor(0, 50);
    display.print(F("CR:"));
    display.print(state_corr1_light ? F("L1:ON ") : F("L1:-- "));
    display.print(state_corr2_light ? F("L2:ON")  : F("L2:--"));

    display.display();
    lastDisplayUpdate = now;
  }

  // Prevent ESP32 task starvation / watchdog triggers
  delay(2);
}
