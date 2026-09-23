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

#include "soc/rtc_cntl_reg.h"
#include "soc/soc.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Arduino.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <ESP32Servo.h>
#include <ESPmDNS.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>

#include "config.h"

// ==========================================
// --- HARDWARE INSTANCES ---
// ==========================================
WebServer server(WEB_SERVER_PORT);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET_PIN);
DHT dht(DHTPIN, DHTTYPE);
Servo curtain1;
Servo curtain2;
Preferences preferences;

// ==========================================
// --- SYSTEM STATE & THRESHOLDS ---
// ==========================================
volatile bool isAutoMode = false; // Loaded from NVS in setup()
void setSystemModeInternal(bool autoMode, bool notifyCloud = true);

float currentTempThreshold = DEFAULT_TEMP_THRESHOLD;
int currentLdrThreshold = DEFAULT_LDR_THRESHOLD;
unsigned long currentHoldTime = OCCUPANCY_HOLD_MS;

// Shared Sensors
volatile float currentTemp = 24.0;
volatile float currentHum = 50.0;
volatile int ldr1_value = 0;
volatile int ldr2_value = 0;

// Classroom 1 (A101) State
volatile bool pir1_active = false;
volatile bool c1_occupied = false;
volatile unsigned long c1_last_motion = 0;
volatile bool state_c1_light = false;
volatile bool state_c1_fan = false;
volatile bool state_c1_curtain = false;
int current_c1_angle = SERVO_CLOSED_ANGLE;
int target_c1_angle = SERVO_CLOSED_ANGLE;
unsigned long last_servo1_move = 0;
bool servo1_attached = false;

// Classroom 1 (A101) AC Power Meter (ACS712 Current & ZMPT101B Voltage)
volatile float c1_voltage = 0.0;    // Vrms (Volts AC)
volatile float c1_current = 0.0;    // Irms (Amperes AC)
volatile float c1_real_power = 0.0; // P (Watts Active Load)
unsigned long lastPowerSample = 0;

// Dynamic Real Energy Accumulators (kWh & Cost)
volatile double c1_accumulated_kwh = 0.0;
volatile double c2_accumulated_kwh = 0.0;
float c1_hourly_kwh[24] = {0.0f};
unsigned long lastEnergyIntegrateMs = 0;
unsigned long lastEnergySaveNvsMs = 0;
int lastRecordedHour = -1;

// Classroom 2 (A102) State
volatile bool pir2_active = false;
volatile bool c2_occupied = false;
volatile unsigned long c2_last_motion = 0;
volatile bool state_c2_light = false;
volatile bool state_c2_fan = false;
volatile bool state_c2_curtain = false;
int current_c2_angle = SERVO_CLOSED_ANGLE;
int target_c2_angle = SERVO_CLOSED_ANGLE;
unsigned long last_servo2_move = 0;
bool servo2_attached = false;

// Corridor States
volatile bool state_corr1_light = false;
volatile bool state_corr2_light = false;

// Cloud State Tracking (Prevents stale DB polls from overriding local sensor
// actions)
bool cloud_initialized = false;
bool cloud_prev_c1_light = false;
bool cloud_prev_c1_fan = false;
bool cloud_prev_c1_curtain = false;
bool cloud_prev_c2_light = false;
bool cloud_prev_c2_fan = false;
bool cloud_prev_c2_curtain = false;
bool cloud_prev_corr1_light = false;
bool cloud_prev_corr2_light = false;
bool cloud_prev_system_auto = false;
volatile bool pendingModeCloudSync = false;
unsigned long lastLocalModeChange = 0;

// OLED Hardware flag
bool oledFound = false;

// ==========================================
// ==========================================
// --- CLASSROOM A101 AC POWER METER SAMPLING ---
// ==========================================
// Samples ACS712 Current & ZMPT101B Voltage over a 40ms window
// (Exactly two 50Hz AC cycles or 2.4 60Hz cycles)
void sampleA101PowerMeter() {
  unsigned long now = millis();
  if (now - lastPowerSample < POWER_METER_SAMPLE_MS) {
    return;
  }
  lastPowerSample = now;

  // Collect 160 evenly spaced samples over 40ms (250us interval)
  const int NUM_SAMPLES = 160;
  static int rawV[NUM_SAMPLES];
  static int rawI[NUM_SAMPLES];
  long sumRawV = 0;
  long sumRawI = 0;

  for (int i = 0; i < NUM_SAMPLES; i++) {
    rawV[i] = analogRead(ZMPT101B_VOLTAGE_PIN);
    rawI[i] = analogRead(ACS712_CURRENT_PIN);
    sumRawV += rawV[i];
    sumRawI += rawI[i];
    delayMicroseconds(250);
  }

  // Dynamic DC bias midpoint (ACS712 & ZMPT101B naturally center around Vcc/2)
  float midV = (float)sumRawV / NUM_SAMPLES;
  float midI = (float)sumRawI / NUM_SAMPLES;

  // Calculate RMS deviation from DC midpoint
  double sumSqV = 0.0;
  double sumSqI = 0.0;
  for (int i = 0; i < NUM_SAMPLES; i++) {
    float diffV = (float)rawV[i] - midV;
    float diffI = (float)rawI[i] - midI;
    sumSqV += (diffV * diffV);
    sumSqI += (diffI * diffI);
  }

  // Convert ADC counts to RMS Volts at ESP32 pin (3.3V reference on 12-bit ADC)
  float vAdcRms = sqrt(sumSqV / NUM_SAMPLES) * (3.3f / 4095.0f);
  float iAdcRms = sqrt(sumSqI / NUM_SAMPLES) * (3.3f / 4095.0f);

  // Scaled physical values
  float vRms = vAdcRms * ZMPT101B_CALIBRATION;
  float iRms = iAdcRms / ACS712_SENSITIVITY;

  // Robust noise gate:
  // Mains AC is ~230V. Any reading under 60V on an open input is ambient
  // electromagnetic pickup (50Hz antenna effect on high-gain ZMPT101B op-amp).
  if (vRms < 60.0f) {
    vRms = 0.0f;
  }

  // Hall-effect sensor ACS712 has inherent thermal/switching noise (~21mV
  // pk-pk). Readout below 0.09A is quiescent baseline noise.
  if (iRms < 0.09f) {
    iRms = 0.0f;
  }

  // If NO AC Mains line is connected (no voltage detected), there cannot be
  // real AC current or active power. Force clean zero.
  if (vRms < 60.0f) {
    c1_voltage = 0.0f;
    c1_current = 0.0f;
    c1_real_power = 0.0f;
    return;
  }

  c1_voltage = vRms;
  c1_current = iRms;

  // Calculate Real Power (Watts): P = Vrms * Irms * PowerFactor
  if (c1_voltage >= 60.0f && c1_current >= 0.09f) {
    c1_real_power = c1_voltage * c1_current * POWER_FACTOR_A101;
  } else {
    c1_real_power = 0.0f;
  }
}

// ==========================================
// --- POWER TELEMETRY HELPERS ---
// ==========================================
float rated_c1_light = WATTS_CLASS_LIGHT;
float rated_c1_fan = WATTS_CLASS_FAN;
float rated_c2_light = WATTS_CLASS_LIGHT;
float rated_c2_fan = WATTS_CLASS_FAN;
float rated_corr1 = WATTS_CORR_LIGHT;
float rated_corr2 = WATTS_CORR_LIGHT;

float getC1LoadWatts() {
  // If physical ACS712/ZMPT101B detects real active power, use measured value
  if (c1_real_power > 0.5f) {
    return c1_real_power;
  }
  // Otherwise fallback to rated relay load
  float w = 0.0;
  if (state_c1_light)
    w += rated_c1_light;
  if (state_c1_fan)
    w += rated_c1_fan;
  if (state_c1_curtain)
    w += WATTS_SERVO_ACTIVE;
  return w;
}

float getC2LoadWatts() {
  float w = 0.0;
  if (state_c2_light)
    w += rated_c2_light;
  if (state_c2_fan)
    w += rated_c2_fan;
  if (state_c2_curtain)
    w += WATTS_SERVO_ACTIVE;
  return w;
}

float getTotalLoadWatts() {
  float w = getC1LoadWatts() + getC2LoadWatts();
  if (state_corr1_light)
    w += rated_corr1;
  if (state_corr2_light)
    w += rated_corr2;
  return w;
}

float getCorrLoadWatts() {
  float w = 0.0;
  if (state_corr1_light)
    w += rated_corr1;
  if (state_corr2_light)
    w += rated_corr2;
  return w;
}

// ==========================================
// --- REAL-TIME ENERGY INTEGRATION (kWh) ---
// ==========================================
// Integrates real active power over time: kWh = (Watts * dt_hours) / 1000
void integrateRealEnergy() {
  unsigned long now = millis();
  if (lastEnergyIntegrateMs == 0) {
    lastEnergyIntegrateMs = now;
    return;
  }

  unsigned long elapsedMs = now - lastEnergyIntegrateMs;
  if (elapsedMs < 1000) {
    return; // Integrate every ~1.0 second
  }
  lastEnergyIntegrateMs = now;

  double dtHours = (double)elapsedMs / 3600000.0;

  // Classroom 1: Real measured watts (from ACS712 & ZMPT101B when active)
  float w1 = getC1LoadWatts();
  double deltaKwh1 = ((double)w1 / 1000.0) * dtHours;
  c1_accumulated_kwh += deltaKwh1;

  // Classroom 2: Relay-based load
  float w2 = getC2LoadWatts();
  double deltaKwh2 = ((double)w2 / 1000.0) * dtHours;
  c2_accumulated_kwh += deltaKwh2;

  // Track hourly consumption bucket
  struct tm timeinfo;
  int currentHour = (now / 3600000) % 24; // Default fallback to uptime hours
  if (getLocalTime(&timeinfo, 20)) {
    currentHour = timeinfo.tm_hour;
    // Auto-reset daily energy at midnight (00:00)
    if (lastRecordedHour == 23 && currentHour == 0) {
      c1_accumulated_kwh = 0.0;
      c2_accumulated_kwh = 0.0;
      for (int i = 0; i < 24; i++)
        c1_hourly_kwh[i] = 0.0f;
    }
  }
  lastRecordedHour = currentHour;
  if (currentHour >= 0 && currentHour < 24) {
    c1_hourly_kwh[currentHour] += (float)deltaKwh1;
  }

  // Periodic persistence to ESP32 Flash (every 5 minutes)
  if (now - lastEnergySaveNvsMs >= 300000) {
    lastEnergySaveNvsMs = now;
    preferences.putFloat("c1_kwh", (float)c1_accumulated_kwh);
    preferences.putFloat("c2_kwh", (float)c2_accumulated_kwh);
  }
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
      if (current_c1_angle < target_c1_angle)
        current_c1_angle++;
      else
        current_c1_angle--;
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
      if (current_c2_angle < target_c2_angle)
        current_c2_angle++;
      else
        current_c2_angle--;
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
// --- SYSTEM MODE CONTROLLER (NVS PERSISTENT) ---
// ==========================================
void setSystemModeInternal(bool autoMode, bool notifyCloud) {
  if (isAutoMode != autoMode) {
    isAutoMode = autoMode;
    cloud_prev_system_auto = autoMode;
    preferences.putBool("auto_mode", autoMode);
    if (notifyCloud) {
      pendingModeCloudSync = true;
      lastLocalModeChange = millis();
    }
    Serial.printf("[SYSTEM] Mode updated -> %s (saved to NVS)\n",
                  isAutoMode ? "AUTO" : "MANUAL");
  }
}

// ==========================================
// --- PHYSICAL RELAY SYNCHRONIZATION ---
// ==========================================
// Staggered & state-cached relay actuation to prevent simultaneous coil inrush
// current spikes
void applyRelayStates() {
  static int hw_c1_light = -1;
  static int hw_c1_fan = -1;
  static int hw_c2_light = -1;
  static int hw_c2_fan = -1;
  static int hw_corr1 = -1;
  static int hw_corr2 = -1;

  int t_c1_l = state_c1_light ? RELAY_ON : RELAY_OFF;
  if (hw_c1_light != t_c1_l) {
    digitalWrite(RELAY_CLASS_LIGHT1, t_c1_l);
    hw_c1_light = t_c1_l;
    if (t_c1_l == RELAY_ON)
      delay(15); // Suppress multi-relay instantaneous inrush spike
  }

  int t_c1_f = state_c1_fan ? RELAY_ON : RELAY_OFF;
  if (hw_c1_fan != t_c1_f) {
    digitalWrite(RELAY_CLASS_FAN1, t_c1_f);
    hw_c1_fan = t_c1_f;
    if (t_c1_f == RELAY_ON)
      delay(15);
  }

  int t_c2_l = state_c2_light ? RELAY_ON : RELAY_OFF;
  if (hw_c2_light != t_c2_l) {
    digitalWrite(RELAY_CLASS_LIGHT2, t_c2_l);
    hw_c2_light = t_c2_l;
    if (t_c2_l == RELAY_ON)
      delay(15);
  }

  int t_c2_f = state_c2_fan ? RELAY_ON : RELAY_OFF;
  if (hw_c2_fan != t_c2_f) {
    digitalWrite(RELAY_CLASS_FAN2, t_c2_f);
    hw_c2_fan = t_c2_f;
    if (t_c2_f == RELAY_ON)
      delay(15);
  }

  int t_cr1 = state_corr1_light ? RELAY_ON : RELAY_OFF;
  if (hw_corr1 != t_cr1) {
    digitalWrite(RELAY_CORRIDOR_LIGHT1, t_cr1);
    hw_corr1 = t_cr1;
    if (t_cr1 == RELAY_ON)
      delay(15);
  }

  int t_cr2 = state_corr2_light ? RELAY_ON : RELAY_OFF;
  if (hw_corr2 != t_cr2) {
    digitalWrite(RELAY_CORRIDOR_LIGHT2, t_cr2);
    hw_corr2 = t_cr2;
    if (t_cr2 == RELAY_ON)
      delay(15);
  }
}

// ==========================================
// --- HTTP / CORS HELPERS ---
// ==========================================
void enableCORS() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT");
  server.sendHeader("Access-Control-Allow-Headers",
                    "Content-Type, Authorization, X-Requested-With");
}

void handleOptions() {
  enableCORS();
  server.send(204);
}

// ==========================================
// --- REST API: STATUS ---
// ==========================================
// Generates status JSON (100% backward compatible with original code + app
// fields)
String buildStatusJson(bool includeTelemetry = true) {
  String json = "{";
  json += "\"status\":\"ok\",";
  json += "\"mode\":\"" + String(isAutoMode ? "auto" : "manual") + "\",";
  json += "\"temperature\":" + String(currentTemp, 1) + ",";
  json += "\"humidity\":" + String(currentHum, 1) + ",";
  json += "\"total_load_watts\":" + String(getTotalLoadWatts(), 1) + ",";

  // Classroom 1 (cls-a101) - Equipped with ACS712 & ZMPT101B
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
  json += "\"load_watts\":" + String(getC1LoadWatts(), 1) + ",";
  json += "\"voltage\":" + String(c1_voltage, 1) + ",";
  json += "\"current\":" + String(c1_current, 2) + ",";
  json += "\"power_watts\":" + String(c1_real_power, 1) + ",";
  json += "\"energy_today\":" + String(c1_accumulated_kwh, 4) + ",";
  json += "\"estimated_cost\":" + String(c1_accumulated_kwh * 8.0, 2) + ",";
  json += "\"has_power_meter\":true";
  json += "},";

  // Classroom 2 (cls-a102) - Standard setup (No Power Meter)
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
  json += "\"load_watts\":" + String(getC2LoadWatts(), 1) + ",";
  json += "\"voltage\":0.0,";
  json += "\"current\":0.0,";
  json += "\"power_watts\":0.0,";
  json += "\"energy_today\":" + String(c2_accumulated_kwh, 4) + ",";
  json += "\"estimated_cost\":" + String(c2_accumulated_kwh * 8.0, 2) + ",";
  json += "\"has_power_meter\":false";
  json += "},";

  // Corridors
  json += "\"corridors\":{";
  json += "\"ldr1_raw\":" + String(ldr1_value) + ",";
  json += "\"light1\":" + String(state_corr1_light ? "true" : "false") + ",";
  json += "\"ldr2_raw\":" + String(ldr2_value) + ",";
  json += "\"light2\":" + String(state_corr2_light ? "true" : "false");
  json += "},";

  // Real 24-hour Energy Consumption Array (for App Consumption Charts)
  json += "\"hourly_energy\":[";
  for (int h = 0; h < 24; h++) {
    json += String(c1_hourly_kwh[h], 4);
    if (h < 23)
      json += ",";
  }
  json += "]";

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
  if (server.hasArg("auto")) {
    setSystemModeInternal(
        server.arg("auto") == "1" || server.arg("auto") == "true", true);
  } else if (server.hasArg("plain")) {
    String body = server.arg("plain");
    if (body.indexOf("\"auto\":true") >= 0 || body.indexOf("\"auto\":1") >= 0) {
      setSystemModeInternal(true, true);
    } else if (body.indexOf("\"auto\":false") >= 0 ||
               body.indexOf("\"auto\":0") >= 0) {
      setSystemModeInternal(false, true);
    }
  }
  server.send(200, "application/json",
              "{\"status\":\"ok\",\"mode\":\"" +
                  String(isAutoMode ? "auto" : "manual") + "\"}");
}

// ==========================================
// --- REST API: CONTROL ---
// ==========================================
// Supports legacy query params (dev=l1&st=1) AND modern app device IDs
void applyDeviceControl(String dev, bool st) {
  dev.toLowerCase();

  // Classroom 1 / A101
  if (dev == "l1" || dev == "light1" || dev == "dev-a101-light" ||
      dev == "dev-a101-light-1" || dev == "dev-a101-light-2") {
    state_c1_light = st;
  } else if (dev == "f1" || dev == "fan1" || dev == "dev-a101-fan" ||
             dev == "dev-a101-fan-1" || dev == "dev-a101-fan-2") {
    state_c1_fan = st;
  } else if (dev == "c1" || dev == "curtain1" || dev == "dev-a101-curtain") {
    state_c1_curtain = st;
  }
  // Classroom 2 / A102
  else if (dev == "l2" || dev == "light2" || dev == "dev-a102-light" ||
           dev == "dev-a102-light-1" || dev == "dev-a102-light-2") {
    state_c2_light = st;
  } else if (dev == "f2" || dev == "fan2" || dev == "dev-a102-fan" ||
             dev == "dev-a102-fan-1" || dev == "dev-a102-fan-2") {
    state_c2_fan = st;
  } else if (dev == "c2" || dev == "curtain2" || dev == "dev-a102-curtain") {
    state_c2_curtain = st;
  }
  // Corridors
  else if (dev == "cr1" || dev == "corridor1" || dev == "corr1" ||
           dev == "dev-corr-light1" || dev == "dev-corr-light-1") {
    state_corr1_light = st;
  } else if (dev == "cr2" || dev == "corridor2" || dev == "corr2" ||
             dev == "dev-corr-light2" || dev == "dev-corr-light-2") {
    state_corr2_light = st;
  }
  // Bulk / Emergency Commands
  else if (dev == "all" || dev == "emergency") {
    state_c1_light = st;
    state_c1_fan = st;
    state_c1_curtain = st;
    state_c2_light = st;
    state_c2_fan = st;
    state_c2_curtain = st;
    state_corr1_light = st;
    state_corr2_light = st;
  }

  // Instantly apply relay pin states
  applyRelayStates();
}

void handleControl() {
  enableCORS();

  // Handle Query Parameters (GET /ctrl?dev=l1&st=1)
  if (server.hasArg("dev") && server.arg("st")) {
    String dev = server.arg("dev");
    bool st = (server.arg("st") == "1" || server.arg("st") == "true" ||
               server.arg("st") == "on");

    // Valid manual command received: Switch to manual mode
    if (isAutoMode) {
      setSystemModeInternal(false, true);
      Serial.println(
          F("[SYSTEM] Manual command received -> Switched to MANUAL Mode"));
    }

    applyDeviceControl(dev, st);
    server.send(200, "application/json",
                "{\"status\":\"ok\",\"device\":\"" + dev +
                    "\",\"state\":" + String(st ? "true" : "false") + "}");
    return;
  }

  // Handle JSON POST Body (POST /api/control with {"dev":"l1","st":1} or
  // {"deviceId":"...","state":"..."})
  if (server.hasArg("plain")) {
    String body = server.arg("plain");
    String dev = "";
    bool st = false;

    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, body);
    if (!err) {
      if (doc.containsKey("dev")) {
        dev = doc["dev"].as<String>();
      } else if (doc.containsKey("deviceId")) {
        dev = doc["deviceId"].as<String>();
      }

      if (doc.containsKey("st")) {
        st = doc["st"].as<bool>() || (doc["st"].as<int>() == 1);
      } else if (doc.containsKey("state")) {
        String stStr = doc["state"].as<String>();
        st = (stStr == "1" || stStr == "true" || stStr == "on");
      }
    } else {
      // Fallback substring search if JSON is malformed
      if (body.indexOf("\"st\":1") >= 0 || body.indexOf("\"st\":true") >= 0 ||
          body.indexOf("\"state\":true") >= 0 ||
          body.indexOf("\"state\":\"on\"") >= 0) {
        st = true;
      }
      int devIdx = body.indexOf("\"dev\":\"");
      if (devIdx >= 0) {
        int start = devIdx + 7;
        int end = body.indexOf("\"", start);
        if (end > start)
          dev = body.substring(start, end);
      } else {
        int idIdx = body.indexOf("\"deviceId\":\"");
        if (idIdx >= 0) {
          int start = idIdx + 12;
          int end = body.indexOf("\"", start);
          if (end > start)
            dev = body.substring(start, end);
        }
      }
    }

    if (dev.length() > 0) {
      // Valid manual command received: Switch to manual mode
      if (isAutoMode) {
        setSystemModeInternal(false, true);
        Serial.println(
            F("[SYSTEM] Manual command received -> Switched to MANUAL Mode"));
      }
      applyDeviceControl(dev, st);
      server.send(200, "application/json",
                  "{\"status\":\"ok\",\"device\":\"" + dev +
                      "\",\"state\":" + String(st ? "true" : "false") + "}");
      return;
    }
  }

  server.send(400, "application/json",
              "{\"status\":\"error\",\"message\":\"Missing 'dev' and 'st' "
              "parameters\"}");
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
  if (server.hasArg("c1_light_w")) {
    rated_c1_light = server.arg("c1_light_w").toFloat();
    preferences.putFloat("r_c1_l", rated_c1_light);
  }
  if (server.hasArg("c1_fan_w")) {
    rated_c1_fan = server.arg("c1_fan_w").toFloat();
    preferences.putFloat("r_c1_f", rated_c1_fan);
  }
  if (server.hasArg("c2_light_w")) {
    rated_c2_light = server.arg("c2_light_w").toFloat();
    preferences.putFloat("r_c2_l", rated_c2_light);
  }
  if (server.hasArg("c2_fan_w")) {
    rated_c2_fan = server.arg("c2_fan_w").toFloat();
    preferences.putFloat("r_c2_f", rated_c2_fan);
  }
  if (server.hasArg("corr1_w")) {
    rated_corr1 = server.arg("corr1_w").toFloat();
    preferences.putFloat("r_cr1", rated_corr1);
  }
  if (server.hasArg("corr2_w")) {
    rated_corr2 = server.arg("corr2_w").toFloat();
    preferences.putFloat("r_cr2", rated_corr2);
  }

  String json = "{";
  json += "\"status\":\"ok\",";
  json += "\"temp_threshold\":" + String(currentTempThreshold, 1) + ",";
  json += "\"ldr_threshold\":" + String(currentLdrThreshold) + ",";
  json += "\"hold_time_ms\":" + String(currentHoldTime) + ",";
  json += "\"c1_light_w\":" + String(rated_c1_light, 1) + ",";
  json += "\"c1_fan_w\":" + String(rated_c1_fan, 1);
  json += "}";
  server.send(200, "application/json", json);
}

// ==========================================
// --- REST API: ROOT ---
// ==========================================
void handleRoot() {
  enableCORS();
  server.send(200, "application/json",
              "{\"system\":\"NBA Smart Classroom Controller\",\"firmware\":\"" +
                  String(FIRMWARE_VERSION) + "\",\"status\":\"online\"}");
}

// Forward declaration for FreeRTOS background cloud task
void supabaseCloudTask(void *pvParameters);

// ==========================================
// --- SETUP INITIALIZATION ---
// ==========================================
void setup() {
  // 0. Disable Hardware Brownout Detector so momentary coil/servo inrush
  // currents don't cause CPU reset
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  delay(200);
  Serial.println(F("\n=============================================="));
  Serial.println(F(" NBA SMART CLASSROOM - DUAL ZONE CONTROLLER"));
  Serial.printf(F(" Firmware Version: %s\n"), FIRMWARE_VERSION);
  Serial.println(F("=============================================="));

  // Initialize NVS Preferences to restore persistent system mode & energy
  // across boots
  preferences.begin("nba_scr", false);
  isAutoMode = preferences.getBool("auto_mode", false);
  c1_accumulated_kwh = preferences.getFloat("c1_kwh", 0.0f);
  c2_accumulated_kwh = preferences.getFloat("c2_kwh", 0.0f);
  rated_c1_light = preferences.getFloat("r_c1_l", WATTS_CLASS_LIGHT);
  rated_c1_fan = preferences.getFloat("r_c1_f", WATTS_CLASS_FAN);
  rated_c2_light = preferences.getFloat("r_c2_l", WATTS_CLASS_LIGHT);
  rated_c2_fan = preferences.getFloat("r_c2_f", WATTS_CLASS_FAN);
  rated_corr1 = preferences.getFloat("r_cr1", WATTS_CORR_LIGHT);
  rated_corr2 = preferences.getFloat("r_cr2", WATTS_CORR_LIGHT);
  cloud_prev_system_auto = isAutoMode;
  Serial.printf("[SYSTEM] Boot System Mode: %s | Restored Energy: C1=%.4f kWh, "
                "C2=%.4f kWh\n",
                isAutoMode ? "AUTO" : "MANUAL", (float)c1_accumulated_kwh,
                (float)c2_accumulated_kwh);

  // Sync NTP Time (IST +5:30)
  configTime(19800, 0, "pool.ntp.org", "time.google.com");

  // 1. Initialize Sensor Pins
  dht.begin();
  pinMode(PIR1_PIN, INPUT_PULLDOWN);
  pinMode(PIR2_PIN, INPUT_PULLDOWN);
  pinMode(LDR_CORRIDOR1_PIN, INPUT);
  pinMode(LDR_CORRIDOR2_PIN, INPUT);
  pinMode(ACS712_CURRENT_PIN, INPUT);
  pinMode(ZMPT101B_VOLTAGE_PIN, INPUT);

  // 2. Initialize Relay Output Pins
  pinMode(RELAY_CLASS_LIGHT1, OUTPUT);
  pinMode(RELAY_CLASS_FAN1, OUTPUT);
  pinMode(RELAY_CLASS_LIGHT2, OUTPUT);
  pinMode(RELAY_CLASS_FAN2, OUTPUT);
  pinMode(RELAY_CORRIDOR_LIGHT1, OUTPUT);
  pinMode(RELAY_CORRIDOR_LIGHT2, OUTPUT);

  // Explicitly initialize relay pins to OFF before attaching loads
  digitalWrite(RELAY_CLASS_LIGHT1, RELAY_OFF);
  digitalWrite(RELAY_CLASS_FAN1, RELAY_OFF);
  digitalWrite(RELAY_CLASS_LIGHT2, RELAY_OFF);
  digitalWrite(RELAY_CLASS_FAN2, RELAY_OFF);
  digitalWrite(RELAY_CORRIDOR_LIGHT1, RELAY_OFF);
  digitalWrite(RELAY_CORRIDOR_LIGHT2, RELAY_OFF);
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
    Serial.println(
        F("[WARN] OLED SSD1306 allocation failed (check SDA/SCL pins)"));
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
    Serial.println(
        F("\n[WARN] Wi-Fi connection timed out. Starting offline demo mode."));
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

  // 8. Register REST API Handlers (App JSON Interface)
  server.on("/", HTTP_GET, handleRoot);
  server.on("/status", HTTP_GET, handleStatus);     // Status endpoint for App
  server.on("/api/status", HTTP_GET, handleStatus); // Enhanced REST status
  server.on("/mode", HTTP_GET, handleMode);         // Mode toggle
  server.on("/api/mode", HTTP_ANY, handleMode);
  server.on("/ctrl", HTTP_GET, handleControl); // Device control
  server.on("/api/control", HTTP_ANY, handleControl);
  server.on("/config", HTTP_GET, handleConfig); // Threshold adjustments
  server.on("/api/config", HTTP_ANY, handleConfig);

  server.onNotFound(handleOptions); // Handle CORS preflight & 404s
  server.begin();
  Serial.println(F("[OK] HTTP API Server Started"));

  // 9. Launch Supabase Cloud Task on Core 0 (Background)
  // 16KB stack space ensures safe mbedTLS execution without stack overflow
  xTaskCreatePinnedToCore(supabaseCloudTask, "SupabaseCloudTask", 16384, NULL,
                          1, NULL, 0);
  Serial.println(F("[OK] Supabase Cloud Background Task started on Core 0"));
}

// ==========================================
// --- SUPABASE CLOUD SYNCHRONIZATION ---
// ==========================================
unsigned long lastSupabasePoll = 0;
unsigned long lastSupabaseTelemetry = 0;
bool supabaseSyncActive = false;

void syncWithSupabase() {
  if (WiFi.status() != WL_CONNECTED)
    return;
  unsigned long now = millis();

  // 0. Sync System Mode to Cloud if changed locally (with retry on failure)
  if (pendingModeCloudSync) {
    WiFiClientSecure mClient;
    mClient.setInsecure();
    mClient.setTimeout(4000);
    HTTPClient mHttps;
    mHttps.setTimeout(4000);
    String urlMode =
        String(SUPABASE_URL) + "/rest/v1/devices?id=eq.dev-system-mode";
    if (mHttps.begin(mClient, urlMode)) {
      mHttps.addHeader("apikey", SUPABASE_KEY);
      mHttps.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
      mHttps.addHeader("Content-Type", "application/json");
      mHttps.addHeader("Prefer", "return=minimal");
      String body =
          "{\"status\":\"" + String(isAutoMode ? "auto" : "manual") + "\"}";
      int httpRes = mHttps.sendRequest("PATCH", body);
      if (httpRes >= 200 && httpRes < 300) {
        pendingModeCloudSync = false;
        cloud_prev_system_auto = isAutoMode;
        Serial.printf("[SUPABASE] Successfully synced system mode '%s' to "
                      "cloud (HTTP %d)\n",
                      isAutoMode ? "auto" : "manual", httpRes);
      } else {
        Serial.printf(
            "[SUPABASE WARN] System mode sync failed (HTTP %d). Retrying.\n",
            httpRes);
      }
      mHttps.end();
      mClient.stop();
    }
    lastSupabasePoll =
        now; // Delay next GET poll slightly so Supabase DB commit settles
  }

  // 1. Fetch Remote Device Commands from Supabase (Every 1000ms)
  if (now - lastSupabasePoll >= SUPABASE_POLL_INTERVAL_MS) {
    lastSupabasePoll = now;

    WiFiClientSecure client;
    client.setInsecure(); // Supabase HTTPS
    client.setTimeout(
        5000); // 5000ms socket timeout (allows TLS handshake over Internet)

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
            const char *id = dev["id"];
            const char *st = dev["status"];
            if (!id || !st)
              continue;

            // 1. System Mode command from Cloud (with anti-echo shield)
            if (strcmp(id, "dev-system-mode") == 0) {
              bool cloudAuto = (strcmp(st, "auto") == 0);

              // Anti-echo protection: Ignore cloud command for 15 seconds after
              // a local change
              if (now - lastLocalModeChange < 15000) {
                continue;
              }

              if (!cloud_initialized) {
                cloud_prev_system_auto = cloudAuto;
                // If boot NVS preference differs from cloud, enforce local NVS
                // over stale cloud!
                if (cloudAuto != isAutoMode) {
                  pendingModeCloudSync = true;
                  lastLocalModeChange = now;
                  Serial.printf("[SYSTEM] Pushing persistent NVS mode '%s' to "
                                "replace stale cloud '%s'\n",
                                isAutoMode ? "AUTO" : "MANUAL",
                                cloudAuto ? "AUTO" : "MANUAL");
                }
              } else if (cloudAuto != cloud_prev_system_auto) {
                cloud_prev_system_auto = cloudAuto;
                setSystemModeInternal(cloudAuto, false);
                Serial.printf("[SYSTEM] Mode changed via Cloud -> %s\n",
                              isAutoMode ? "AUTO" : "MANUAL");
              }
              continue;
            }

            bool isOn = (strcmp(st, "on") == 0);

            // On first boot, record baseline cloud states without triggering
            // actions
            if (!cloud_initialized) {
              if (strcmp(id, "dev-a101-light-1") == 0 ||
                  strcmp(id, "dev-a101-light") == 0)
                cloud_prev_c1_light = isOn;
              else if (strcmp(id, "dev-a101-fan-1") == 0 ||
                       strcmp(id, "dev-a101-fan") == 0)
                cloud_prev_c1_fan = isOn;
              else if (strcmp(id, "dev-a101-curtain") == 0)
                cloud_prev_c1_curtain = isOn;
              else if (strcmp(id, "dev-a102-light-1") == 0 ||
                       strcmp(id, "dev-a102-light") == 0)
                cloud_prev_c2_light = isOn;
              else if (strcmp(id, "dev-a102-fan-1") == 0 ||
                       strcmp(id, "dev-a102-fan") == 0)
                cloud_prev_c2_fan = isOn;
              else if (strcmp(id, "dev-a102-curtain") == 0)
                cloud_prev_c2_curtain = isOn;
              else if (strcmp(id, "dev-corr-light-1") == 0 ||
                       strcmp(id, "dev-corr-light1") == 0)
                cloud_prev_corr1_light = isOn;
              else if (strcmp(id, "dev-corr-light-2") == 0 ||
                       strcmp(id, "dev-corr-light2") == 0)
                cloud_prev_corr2_light = isOn;
              continue;
            }

            // Differential Tracking:
            // CRITICAL: When isAutoMode == true, the local sensors have
            // exclusive authority over relay states. Device polling only
            // updates baseline tracking; it NEVER overrides local sensor relays
            // and NEVER disarms Auto Mode! When in Manual Mode (!isAutoMode),
            // incoming cloud changes actuate relays.
            if (!isAutoMode) {
              if (strcmp(id, "dev-a101-light-1") == 0 ||
                  strcmp(id, "dev-a101-light") == 0) {
                if (isOn != cloud_prev_c1_light) {
                  cloud_prev_c1_light = isOn;
                  state_c1_light = isOn;
                  anyStateChanged = true;
                  Serial.printf("[MANUAL COMMAND] A101 Light -> %s\n",
                                isOn ? "ON" : "OFF");
                }
              } else if (strcmp(id, "dev-a101-fan-1") == 0 ||
                         strcmp(id, "dev-a101-fan") == 0) {
                if (isOn != cloud_prev_c1_fan) {
                  cloud_prev_c1_fan = isOn;
                  state_c1_fan = isOn;
                  anyStateChanged = true;
                  Serial.printf("[MANUAL COMMAND] A101 Fan -> %s\n",
                                isOn ? "ON" : "OFF");
                }
              } else if (strcmp(id, "dev-a101-curtain") == 0) {
                if (isOn != cloud_prev_c1_curtain) {
                  cloud_prev_c1_curtain = isOn;
                  state_c1_curtain = isOn;
                  anyStateChanged = true;
                  Serial.printf("[MANUAL COMMAND] A101 Curtain -> %s\n",
                                isOn ? "OPEN" : "CLOSED");
                }
              } else if (strcmp(id, "dev-a102-light-1") == 0 ||
                         strcmp(id, "dev-a102-light") == 0) {
                if (isOn != cloud_prev_c2_light) {
                  cloud_prev_c2_light = isOn;
                  state_c2_light = isOn;
                  anyStateChanged = true;
                  Serial.printf("[MANUAL COMMAND] A102 Light -> %s\n",
                                isOn ? "ON" : "OFF");
                }
              } else if (strcmp(id, "dev-a102-fan-1") == 0 ||
                         strcmp(id, "dev-a102-fan") == 0) {
                if (isOn != cloud_prev_c2_fan) {
                  cloud_prev_c2_fan = isOn;
                  state_c2_fan = isOn;
                  anyStateChanged = true;
                  Serial.printf("[MANUAL COMMAND] A102 Fan -> %s\n",
                                isOn ? "ON" : "OFF");
                }
              } else if (strcmp(id, "dev-a102-curtain") == 0) {
                if (isOn != cloud_prev_c2_curtain) {
                  cloud_prev_c2_curtain = isOn;
                  state_c2_curtain = isOn;
                  anyStateChanged = true;
                  Serial.printf("[MANUAL COMMAND] A102 Curtain -> %s\n",
                                isOn ? "OPEN" : "CLOSED");
                }
              } else if (strcmp(id, "dev-corr-light-1") == 0 ||
                         strcmp(id, "dev-corr-light1") == 0) {
                if (isOn != cloud_prev_corr1_light) {
                  cloud_prev_corr1_light = isOn;
                  state_corr1_light = isOn;
                  anyStateChanged = true;
                  Serial.printf("[MANUAL COMMAND] Corridor 1 Light -> %s\n",
                                isOn ? "ON" : "OFF");
                }
              } else if (strcmp(id, "dev-corr-light-2") == 0 ||
                         strcmp(id, "dev-corr-light2") == 0) {
                if (isOn != cloud_prev_corr2_light) {
                  cloud_prev_corr2_light = isOn;
                  state_corr2_light = isOn;
                  anyStateChanged = true;
                  Serial.printf("[MANUAL COMMAND] Corridor 2 Light -> %s\n",
                                isOn ? "ON" : "OFF");
                }
              }
            } else {
              // In Auto Mode: keep baseline in sync so switching to Manual
              // later has no stale echo
              if (strcmp(id, "dev-a101-light-1") == 0 ||
                  strcmp(id, "dev-a101-light") == 0)
                cloud_prev_c1_light = isOn;
              else if (strcmp(id, "dev-a101-fan-1") == 0 ||
                       strcmp(id, "dev-a101-fan") == 0)
                cloud_prev_c1_fan = isOn;
              else if (strcmp(id, "dev-a101-curtain") == 0)
                cloud_prev_c1_curtain = isOn;
              else if (strcmp(id, "dev-a102-light-1") == 0 ||
                       strcmp(id, "dev-a102-light") == 0)
                cloud_prev_c2_light = isOn;
              else if (strcmp(id, "dev-a102-fan-1") == 0 ||
                       strcmp(id, "dev-a102-fan") == 0)
                cloud_prev_c2_fan = isOn;
              else if (strcmp(id, "dev-a102-curtain") == 0)
                cloud_prev_c2_curtain = isOn;
              else if (strcmp(id, "dev-corr-light-1") == 0 ||
                       strcmp(id, "dev-corr-light1") == 0)
                cloud_prev_corr1_light = isOn;
              else if (strcmp(id, "dev-corr-light-2") == 0 ||
                       strcmp(id, "dev-corr-light2") == 0)
                cloud_prev_corr2_light = isOn;
            }
          }

          if (!cloud_initialized)
            cloud_initialized = true;

          if (anyStateChanged) {
            applyRelayStates();
          }
        }
      } else {
        supabaseSyncActive = false;
        static unsigned long lastErr = 0;
        if (millis() - lastErr > 6000) {
          Serial.printf("[SUPABASE ERROR] GET devices HTTP %d: %s\n", httpCode,
                        https.errorToString(httpCode).c_str());
          lastErr = millis();
        }
      }
      https.end();
      client.stop();
    }
  }

  // 2. Push Sensor & Occupancy Telemetry to Supabase (Alternate cycle -
  // prevents TLS memory collision)
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
      String urlA101 =
          String(SUPABASE_URL) + "/rest/v1/classrooms?id=eq.cls-a101";
      if (https.begin(client, urlA101)) {
        https.addHeader("apikey", SUPABASE_KEY);
        https.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
        https.addHeader("Content-Type", "application/json");
        https.addHeader("Prefer", "return=minimal");

        String body =
            "{\"temperature\":" + String(currentTemp, 1) +
            ",\"occupancy_status\":\"" +
            String(c1_occupied ? "occupied" : "vacant") +
            "\",\"current_load\":" + String(getC1LoadWatts(), 1) +
            ",\"energy_today\":" + String(c1_accumulated_kwh, 4) +
            ",\"estimated_cost\":" + String(c1_accumulated_kwh * 8.0, 2) +
            ",\"status\":\"online\"}";
        https.sendRequest("PATCH", body);
        https.end();
        client.stop();
      }
    } else if (telemetryStep == 1) {
      // Slot 1: Classroom A102 Telemetry
      String urlA102 =
          String(SUPABASE_URL) + "/rest/v1/classrooms?id=eq.cls-a102";
      if (https.begin(client, urlA102)) {
        https.addHeader("apikey", SUPABASE_KEY);
        https.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
        https.addHeader("Content-Type", "application/json");
        https.addHeader("Prefer", "return=minimal");

        String body =
            "{\"temperature\":" + String(currentTemp, 1) +
            ",\"occupancy_status\":\"" +
            String(c2_occupied ? "occupied" : "vacant") +
            "\",\"current_load\":" + String(getC2LoadWatts(), 1) +
            ",\"energy_today\":" + String(c2_accumulated_kwh, 4) +
            ",\"estimated_cost\":" + String(c2_accumulated_kwh * 8.0, 2) +
            ",\"status\":\"online\"}";
        https.sendRequest("PATCH", body);
        https.end();
        client.stop();
      }
    } else if (telemetryStep == 2) {
      // Slot 2: Corridors Telemetry
      String urlCorr =
          String(SUPABASE_URL) + "/rest/v1/classrooms?id=eq.cls-corridor";
      if (https.begin(client, urlCorr)) {
        https.addHeader("apikey", SUPABASE_KEY);
        https.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
        https.addHeader("Content-Type", "application/json");
        https.addHeader("Prefer", "return=minimal");

        String body = "{\"current_load\":" + String(getCorrLoadWatts(), 1) +
                      ",\"status\":\"online\"}";
        https.sendRequest("PATCH", body);
        https.end();
        client.stop();
      }
    } else {
      // Slot 3: Controller Heartbeat & Live IP
      String urlCtrl =
          String(SUPABASE_URL) + "/rest/v1/controllers?id=eq.ctrl-esp32";
      if (https.begin(client, urlCtrl)) {
        https.addHeader("apikey", SUPABASE_KEY);
        https.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
        https.addHeader("Content-Type", "application/json");
        https.addHeader("Prefer", "return=minimal");

        int rssi = WiFi.RSSI();
        String sig = (rssi > -60) ? "strong" : (rssi > -75) ? "medium" : "weak";
        String body = "{\"status\":\"online\",\"signal_strength\":\"" + sig +
                      "\",\"ip_address\":\"" + WiFi.localIP().toString() +
                      "\",\"firmware_version\":\"" + String(FIRMWARE_VERSION) +
                      "\"}";
        https.sendRequest("PATCH", body);
        https.end();
        client.stop();
      }
    }

    telemetryStep = (telemetryStep + 1) % 4;
  }
}

// Dedicated FreeRTOS background task running on Core 0
// Ensures cloud HTTPS polling NEVER blocks Core 1's local HTTP REST API / relay
// actuation!
void supabaseCloudTask(void *pvParameters) {
  vTaskDelay(pdMS_TO_TICKS(1500)); // Allow Wi-Fi to stabilize
  for (;;) {
    if (WiFi.status() == WL_CONNECTED && strlen(SUPABASE_URL) > 0 &&
        strlen(SUPABASE_KEY) > 0) {
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
    if (!isnan(t))
      currentTemp = t;
    if (!isnan(h))
      currentHum = h;
    lastDhtRead = millis();
  }

  // 3. Sample PIR Motion & Corridor LDRs
  pir1_active = (digitalRead(PIR1_PIN) == HIGH);
  pir2_active = (digitalRead(PIR2_PIN) == HIGH);
  ldr1_value = analogRead(LDR_CORRIDOR1_PIN);
  ldr2_value = analogRead(LDR_CORRIDOR2_PIN);

  // 3b. Sample Classroom A101 AC Power Meter (ACS712 & ZMPT101B)
  sampleA101PowerMeter();

  // 3c. Integrate Real-Time Energy (Riemann sum: kWh = Watts * hours / 1000)
  integrateRealEnergy();

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
      state_c1_light = true;
      state_c1_curtain = true;
      state_c1_fan = (currentTemp > currentTempThreshold);
    } else {
      state_c1_light = false;
      state_c1_curtain = false;
      state_c1_fan = false;
    }

    // Classroom 2 Automation
    if (c2_occupied) {
      state_c2_light = true;
      state_c2_curtain = true;
      state_c2_fan = (currentTemp > currentTempThreshold);
    } else {
      state_c2_light = false;
      state_c2_curtain = false;
      state_c2_fan = false;
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
    display.printf("T:%.1fC  H:%.0f%%  %dW", currentTemp, currentHum,
                   (int)getTotalLoadWatts());

    // Line 3: Classroom 1 Status & Energy Meter
    display.setCursor(0, 26);
    if (c1_voltage >= 60.0f || c1_current >= 0.09f) {
      display.printf("A101:%s %.0fV %.2fA", c1_occupied ? "OCC" : "VAC",
                     c1_voltage, c1_current);
    } else {
      display.print(F("C1:"));
      display.print(c1_occupied ? F("[OCC] ") : F("[VAC] "));
      display.print(state_c1_light ? F("L1 ") : F("L0 "));
      display.print(state_c1_fan ? F("F1 ") : F("F0 "));
      display.print(state_c1_curtain ? F("C1") : F("C0"));
    }

    // Line 4: Classroom 2 Status
    display.setCursor(0, 38);
    display.print(F("C2:"));
    display.print(c2_occupied ? F("[OCC] ") : F("[VAC] "));
    display.print(state_c2_light ? F("L1 ") : F("L0 "));
    display.print(state_c2_fan ? F("F1 ") : F("F0 "));
    display.print(state_c2_curtain ? F("C1") : F("C0"));

    // Line 5: Corridors
    display.setCursor(0, 50);
    display.print(F("CR:"));
    display.print(state_corr1_light ? F("L1:ON ") : F("L1:-- "));
    display.print(state_corr2_light ? F("L2:ON") : F("L2:--"));

    display.display();
    lastDisplayUpdate = now;
  }

  // Prevent ESP32 task starvation / watchdog triggers
  delay(2);
}
