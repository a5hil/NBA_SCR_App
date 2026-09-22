/**
 * ============================================================================
 * SMART CLASSROOM AUTOMATION - ESP32 EMBEDDED CONTROLLER FIRMWARE
 * ============================================================================
 * Target: ESP32-WROOM-32 / ESP32 Dev Module
 * App: NBA Smart Classroom Automation Mobile App (NBA_SCR_App)
 * 
 * Features:
 *  1. 8-Channel Industrial Relay Control (Active LOW / Active HIGH configurable)
 *  2. Dual-Mode Communication:
 *     - Local REST API Web Server on Port 80 (Sub-millisecond LAN response)
 *     - Direct Supabase Cloud REST Sync (Telemetry, Heartbeat, Remote Control)
 *  3. Ambient Climate & Safety Telemetry:
 *     - Temperature & Humidity sensing via DHT11/DHT22
 *     - Room Occupancy detection via PIR Motion Sensor (HC-SR501)
 *     - Real-time Electrical Load monitoring (Watts)
 *  4. Non-Volatile Memory (NVS):
 *     - Retains relay states across campus power outages
 *  5. Wi-Fi Auto-Reconnection & Dynamic RSSI Signal Strength Evaluation
 * ============================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <DHT.h>
#include "config.h"

// -----------------------------------------------------------------------------
// Global Instances & State
// -----------------------------------------------------------------------------
WebServer server(LOCAL_SERVER_PORT);
DHT dht(DHT_PIN, DHT_TYPE);
Preferences preferences;

// Relay states array (false = OFF, true = ON)
bool relayStates[TOTAL_RELAY_CHANNELS] = {false};

// Sensor telemetry values
float currentTemperature = 24.0;
float currentHumidity    = 50.0;
bool  isOccupied         = false;
float currentLoadWatts   = 0.0;
unsigned long lastMotionDetectedTime = 0;

// Non-blocking timer timestamps
unsigned long lastSupabasePullTime  = 0;
unsigned long lastTelemetryPushTime = 0;
unsigned long lastHeartbeatPushTime = 0;
unsigned long lastSensorReadTime    = 0;
unsigned long lastWifiCheckTime     = 0;

// -----------------------------------------------------------------------------
// Forward Declarations
// -----------------------------------------------------------------------------
void setupWiFi();
void setupRelays();
void setupWebServer();
void handleRoot();
void handleGetStatus();
void handlePostRelay();
void handleEmergencyOff();
void handleNotFound();
void setCORSHeaders();

void readSensors();
float calculateCurrentLoad();
String getSignalStrength(int rssi);
void setRelay(uint8_t channelIndex, bool state, bool saveNvs = true, bool updateSupabase = false);
void setAllRelays(bool state);

void pullDeviceCommandsFromSupabase();
void pushTelemetryToSupabase();
void pushHeartbeatToSupabase();
void syncDeviceStateToSupabase(uint8_t channelIndex, bool state);

// =============================================================================
// SETUP
// =============================================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=======================================================");
  Serial.println("  NBA SMART CLASSROOM CONTROLLER (ESP32)");
  Serial.printf("  Controller ID: %s | Classroom: %s\n", CONTROLLER_ID, CLASSROOM_ID);
  Serial.printf("  Firmware Version: %s\n", FIRMWARE_VERSION);
  Serial.println("=======================================================\n");

  // Status LED
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);

  // Initialize Sensors
  pinMode(PIR_PIN, INPUT);
  dht.begin();

  // Initialize NVS Preferences
  preferences.begin("classroom_ctrl", false);

  // Initialize Relays (Restoring previous state from NVS)
  setupRelays();

  // Connect to Wi-Fi
  setupWiFi();

  // Setup Local REST API Server
  setupWebServer();

  // Initial sensor read
  readSensors();

  // Initial cloud sync if connected
  if (WiFi.status() == WL_CONNECTED) {
    pushHeartbeatToSupabase();
    pushTelemetryToSupabase();
    pullDeviceCommandsFromSupabase();
  }

  Serial.println("\n>>> System Initialization Completed Successfully. <<<\n");
}

// =============================================================================
// MAIN LOOP
// =============================================================================
void loop() {
  // Handle local HTTP requests with highest priority
  server.handleClient();

  unsigned long currentMillis = millis();

  // 1. Periodic Sensor Reading
  if (currentMillis - lastSensorReadTime >= SENSOR_READ_INTERVAL_MS) {
    lastSensorReadTime = currentMillis;
    readSensors();
  }

  // 2. Wi-Fi Reconnect Watchdog (Check every 10 seconds)
  if (currentMillis - lastWifiCheckTime >= 10000) {
    lastWifiCheckTime = currentMillis;
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WIFI] Connection lost. Reconnecting...");
      digitalWrite(STATUS_LED_PIN, LOW);
      WiFi.reconnect();
    } else {
      digitalWrite(STATUS_LED_PIN, HIGH);
    }
  }

  // If Wi-Fi is not connected, skip cloud sync tasks
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  // 3. Pull Device Commands from Supabase (Remote mobile control)
  if (currentMillis - lastSupabasePullTime >= SUPABASE_PULL_INTERVAL_MS) {
    lastSupabasePullTime = currentMillis;
    pullDeviceCommandsFromSupabase();
  }

  // 4. Push Live Telemetry to Supabase (Temperature, Load, Occupancy)
  if (currentMillis - lastTelemetryPushTime >= TELEMETRY_PUSH_INTERVAL_MS) {
    lastTelemetryPushTime = currentMillis;
    pushTelemetryToSupabase();
  }

  // 5. Push Heartbeat to Supabase (Controller status, last_seen, IP, RSSI)
  if (currentMillis - lastHeartbeatPushTime >= HEARTBEAT_PUSH_INTERVAL_MS) {
    lastHeartbeatPushTime = currentMillis;
    pushHeartbeatToSupabase();
  }
}

// =============================================================================
// RELAY & HARDWARE MANAGEMENT
// =============================================================================
void setupRelays() {
  Serial.println("[HARDWARE] Initializing 8-Channel Relay Module...");
  for (uint8_t i = 0; i < TOTAL_RELAY_CHANNELS; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);

    // Read stored state from non-volatile storage (defaults to false / OFF)
    char key[8];
    snprintf(key, sizeof(key), "ch_%d", i + 1);
    bool savedState = preferences.getBool(key, false);
    
    // Apply state
    setRelay(i, savedState, false, false);
    Serial.printf("  - Relay Ch %d (GPIO %02d): %s\n", i + 1, RELAY_PINS[i], savedState ? "ON" : "OFF");
  }
}

void setRelay(uint8_t channelIndex, bool state, bool saveNvs, bool updateSupabase) {
  if (channelIndex >= TOTAL_RELAY_CHANNELS) return;

  relayStates[channelIndex] = state;

  // Active-LOW vs Active-HIGH handling
  uint8_t pinLevel;
  if (RELAY_ACTIVE_LOW) {
    pinLevel = state ? LOW : HIGH;
  } else {
    pinLevel = state ? HIGH : LOW;
  }
  digitalWrite(RELAY_PINS[channelIndex], pinLevel);

  // Persist state to NVS so it survives power cycles
  if (saveNvs) {
    char key[8];
    snprintf(key, sizeof(key), "ch_%d", channelIndex + 1);
    preferences.putBool(key, state);
  }

  // Optional sync back to Supabase if triggered locally
  if (updateSupabase && WiFi.status() == WL_CONNECTED) {
    syncDeviceStateToSupabase(channelIndex, state);
  }

  // Recalculate power load
  currentLoadWatts = calculateCurrentLoad();
}

void setAllRelays(bool state) {
  for (uint8_t i = 0; i < TOTAL_RELAY_CHANNELS; i++) {
    setRelay(i, state, true, false);
  }
}

// =============================================================================
// SENSOR PROCESSING
// =============================================================================
void readSensors() {
  // 1. Read DHT Sensor
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t) && t > -20.0 && t < 80.0) {
    currentTemperature = t;
  }
  if (!isnan(h) && h >= 0.0 && h <= 100.0) {
    currentHumidity = h;
  }

  // 2. Read PIR Motion Sensor
  int motion = digitalRead(PIR_PIN);
  if (motion == HIGH) {
    lastMotionDetectedTime = millis();
    isOccupied = true;
  } else {
    // Keep marked occupied until timeout expires
    if (millis() - lastMotionDetectedTime > (OCCUPANCY_HOLD_SEC * 1000UL)) {
      isOccupied = false;
    }
  }

  // 3. Current Load calculation
  currentLoadWatts = calculateCurrentLoad();
}

float calculateCurrentLoad() {
#if USE_PHYSICAL_CURRENT_SENSOR
  // Real analog current sampling via ACS712 / CT Sensor
  int rawADC = analogRead(CURRENT_SENSOR_PIN);
  float voltageMv = (rawADC / 4095.0) * 3300.0;
  float currentAmps = abs(voltageMv - ACS_ZERO_CURRENT_MV) / ACS_SENSITIVITY_MV_A;
  return currentAmps * MAINS_VOLTAGE;
#else
  // Dynamic load synthesis based on active relays and appliance power ratings
  float total = 0.0;
  for (uint8_t i = 0; i < TOTAL_RELAY_CHANNELS; i++) {
    if (relayStates[i]) {
      total += CHANNEL_DEFAULT_WATTAGE[i];
    }
  }
  return total;
#endif
}

String getSignalStrength(int rssi) {
  if (rssi >= -65) return "strong";
  if (rssi >= -80) return "medium";
  return "weak";
}

// =============================================================================
// WI-FI INITIALIZATION
// =============================================================================
void setupWiFi() {
  Serial.printf("[WIFI] Connecting to SSID: %s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < WIFI_CONNECT_TIMEOUT_MS) {
    delay(500);
    Serial.print(".");
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(STATUS_LED_PIN, HIGH);
    Serial.println("\n[WIFI] Connected Successfully!");
    Serial.printf("  - IP Address:  %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("  - MAC Address: %s\n", WiFi.macAddress().c_str());
    Serial.printf("  - Signal RSSI: %d dBm (%s)\n", WiFi.RSSI(), getSignalStrength(WiFi.RSSI()).c_str());
  } else {
    digitalWrite(STATUS_LED_PIN, LOW);
    Serial.println("\n[WIFI] Warning: Failed to connect to Wi-Fi. Running in Local Offline Mode.");
  }
}

// =============================================================================
// LOCAL REST API & WEB SERVER (Port 80)
// =============================================================================
void setCORSHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

void setupWebServer() {
  // CORS Pre-flight handler
  server.on("/api/status", HTTP_OPTIONS, []() {
    setCORSHeaders();
    server.send(204);
  });
  server.on("/api/relay", HTTP_OPTIONS, []() {
    setCORSHeaders();
    server.send(204);
  });
  server.on("/api/emergency", HTTP_OPTIONS, []() {
    setCORSHeaders();
    server.send(204);
  });

  // REST API Routes
  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/status", HTTP_GET, handleGetStatus);
  server.on("/api/relay", HTTP_POST, handlePostRelay);
  server.on("/api/emergency", HTTP_POST, handleEmergencyOff);
  server.onNotFound(handleNotFound);

  server.begin();
  Serial.printf("[HTTP] Local REST Server started on http://%s:80\n", WiFi.localIP().toString().c_str());
}

// Root page: Diagnostic HTML Dashboard
void handleRoot() {
  setCORSHeaders();
  String html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<title>Smart Classroom Controller</title>";
  html += "<style>body{background:#080908;color:#FFF;font-family:-apple-system,sans-serif;padding:20px;margin:0}";
  html += ".card{background:#1B1B1B;padding:16px;border-radius:16px;margin-bottom:16px;border:1px solid rgba(255,255,255,0.08)}";
  html += "h1{color:#FDA83A;font-size:20px;margin-top:0}.btn{background:#FDA83A;color:#000;padding:10px 16px;border:none;border-radius:12px;font-weight:bold;cursor:pointer}";
  html += ".stat{display:flex;justify-content:space-between;margin:8px 0;color:#AAA}.stat b{color:#FFF}</style></head><body>";
  html += "<h1>Smart Classroom Controller (" + String(CONTROLLER_NAME) + ")</h1>";
  html += "<div class='card'>";
  html += "<div class='stat'><span>Classroom:</span><b>" + String(CLASSROOM_ID) + "</b></div>";
  html += "<div class='stat'><span>Temperature:</span><b>" + String(currentTemperature, 1) + " &deg;C</b></div>";
  html += "<div class='stat'><span>Humidity:</span><b>" + String(currentHumidity, 1) + " %</b></div>";
  html += "<div class='stat'><span>Occupancy:</span><b>" + String(isOccupied ? "Occupied" : "Vacant") + "</b></div>";
  html += "<div class='stat'><span>Current Load:</span><b>" + String(currentLoadWatts, 1) + " W</b></div>";
  html += "<div class='stat'><span>Signal RSSI:</span><b>" + String(WiFi.RSSI()) + " dBm</b></div>";
  html += "</div><div class='card'><h3>Relay Channels</h3>";

  for (int i = 0; i < TOTAL_RELAY_CHANNELS; i++) {
    html += "<div class='stat'><span>Channel " + String(i + 1) + ":</span><b>" + (relayStates[i] ? "ON" : "OFF") + "</b></div>";
  }
  html += "</div></body></html>";

  server.send(200, "text/html", html);
}

// GET /api/status - Complete controller JSON status
void handleGetStatus() {
  setCORSHeaders();

  StaticJsonDocument<1024> doc;
  doc["controller_id"]    = CONTROLLER_ID;
  doc["classroom_id"]     = CLASSROOM_ID;
  doc["status"]           = "online";
  doc["ip"]               = WiFi.localIP().toString();
  doc["mac"]              = WiFi.macAddress();
  doc["rssi"]             = WiFi.RSSI();
  doc["signal_strength"]  = getSignalStrength(WiFi.RSSI());
  doc["firmware_version"] = FIRMWARE_VERSION;

  JsonObject sensors = doc.createNestedObject("sensors");
  sensors["temperature"]   = currentTemperature;
  sensors["humidity"]      = currentHumidity;
  sensors["occupancy"]     = isOccupied ? "occupied" : "vacant";
  sensors["current_load"]  = currentLoadWatts;

  JsonArray relays = doc.createNestedArray("relays");
  for (int i = 0; i < TOTAL_RELAY_CHANNELS; i++) {
    JsonObject r = relays.createNestedObject();
    r["channel"] = i + 1;
    r["gpio"]    = RELAY_PINS[i];
    r["state"]   = relayStates[i] ? "on" : "off";
    r["power"]   = relayStates[i] ? CHANNEL_DEFAULT_WATTAGE[i] : 0.0;
  }

  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

// POST /api/relay - Toggle or set relay channel
// Accepts JSON: {"channel": 1, "state": "on"|"off"}
void handlePostRelay() {
  setCORSHeaders();

  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\": \"Missing JSON body\"}");
    return;
  }

  String body = server.arg("plain");
  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    server.send(400, "application/json", "{\"error\": \"Invalid JSON\"}");
    return;
  }

  int channel = doc["channel"] | 0;
  if (channel < 1 || channel > TOTAL_RELAY_CHANNELS) {
    server.send(400, "application/json", "{\"error\": \"Invalid relay channel (1-8)\"}");
    return;
  }

  bool newState = false;
  if (doc["state"].is<const char*>()) {
    String stateStr = doc["state"].as<String>();
    stateStr.toLowerCase();
    newState = (stateStr == "on" || stateStr == "true" || stateStr == "1");
  } else if (doc["state"].is<int>()) {
    newState = (doc["state"].as<int>() == 1);
  } else if (doc["state"].is<bool>()) {
    newState = doc["state"].as<bool>();
  }

  // Update physical relay and sync back to Supabase
  setRelay(channel - 1, newState, true, true);

  StaticJsonDocument<128> resDoc;
  resDoc["success"] = true;
  resDoc["channel"] = channel;
  resDoc["state"]   = newState ? "on" : "off";

  String resStr;
  serializeJson(resDoc, resStr);
  server.send(200, "application/json", resStr);
}

// POST /api/emergency - Emergency power shutdown
void handleEmergencyOff() {
  setCORSHeaders();
  Serial.println("[SAFETY] EMERGENCY SHUTDOWN TRIGGERED! Powering off all relays.");
  setAllRelays(false);

  // Push immediate telemetry
  pushTelemetryToSupabase();

  server.send(200, "application/json", "{\"success\": true, \"message\": \"All relays shut down\"}");
}

void handleNotFound() {
  setCORSHeaders();
  server.send(404, "application/json", "{\"error\": \"Endpoint not found\"}");
}

// =============================================================================
// SUPABASE CLOUD REST INTEGRATION
// =============================================================================

// Helper: Setup secure HTTPS client for Supabase REST API
void configureSecureClient(WiFiClientSecure &client) {
  // Disables strict CA root certificate verification on ESP32 to prevent clock/expiration failures
  client.setInsecure();
}

/**
 * Pulls device target states from Supabase 'devices' table.
 * Query: GET /rest/v1/devices?classroom_id=eq.{CLASSROOM_ID}&select=id,relay_channel,status
 */
void pullDeviceCommandsFromSupabase() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  configureSecureClient(client);
  HTTPClient http;

  String url = String(SUPABASE_URL) + "/rest/v1/devices?classroom_id=eq." + String(CLASSROOM_ID) + "&select=id,relay_channel,status";

  http.begin(client, url);
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    DynamicJsonDocument doc(4096);
    DeserializationError err = deserializeJson(doc, payload);

    if (!err && doc.is<JsonArray>()) {
      JsonArray arr = doc.as<JsonArray>();
      for (JsonObject dev : arr) {
        int ch = dev["relay_channel"] | 0;
        const char* status = dev["status"] | "off";

        if (ch >= 1 && ch <= TOTAL_RELAY_CHANNELS) {
          bool shouldBeOn = (strcmp(status, "on") == 0);
          uint8_t idx = ch - 1;

          // If physical relay differs from database, actuate relay
          if (relayStates[idx] != shouldBeOn) {
            Serial.printf("[SUPABASE SYNC] Device relay #%d updated -> %s\n", ch, shouldBeOn ? "ON" : "OFF");
            setRelay(idx, shouldBeOn, true, false);
          }
        }
      }
    }
  } else {
    // Only log if unexpected status code
    if (httpCode > 0 && httpCode != 200) {
      Serial.printf("[SUPABASE SYNC] Device pull returned HTTP %d\n", httpCode);
    }
  }

  http.end();
}

/**
 * Pushes live environment telemetry to Supabase 'classrooms' table.
 * Endpoint: PATCH /rest/v1/classrooms?id=eq.{CLASSROOM_ID}
 */
void pushTelemetryToSupabase() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  configureSecureClient(client);
  HTTPClient http;

  String url = String(SUPABASE_URL) + "/rest/v1/classrooms?id=eq." + String(CLASSROOM_ID);

  http.begin(client, url);
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal");

  StaticJsonDocument<256> doc;
  doc["temperature"]      = currentTemperature;
  doc["current_load"]     = currentLoadWatts;
  doc["occupancy_status"] = isOccupied ? "occupied" : "vacant";
  doc["status"]           = "online";

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.PATCH(requestBody);
  if (httpCode >= 200 && httpCode < 300) {
    // Telemetry updated successfully
  } else {
    Serial.printf("[SUPABASE] Telemetry push error, HTTP %d\n", httpCode);
  }

  http.end();
}

/**
 * Pushes controller heartbeat to Supabase 'controllers' table.
 * Endpoint: PATCH /rest/v1/controllers?id=eq.{CONTROLLER_ID}
 */
void pushHeartbeatToSupabase() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  configureSecureClient(client);
  HTTPClient http;

  String url = String(SUPABASE_URL) + "/rest/v1/controllers?id=eq." + String(CONTROLLER_ID);

  http.begin(client, url);
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal");

  StaticJsonDocument<256> doc;
  doc["status"]           = "online";
  doc["signal_strength"]  = getSignalStrength(WiFi.RSSI());
  doc["ip_address"]       = WiFi.localIP().toString();
  doc["mac_address"]      = WiFi.macAddress();
  doc["firmware_version"] = FIRMWARE_VERSION;

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.PATCH(requestBody);
  if (httpCode >= 200 && httpCode < 300) {
    // Heartbeat sent successfully
  } else {
    Serial.printf("[SUPABASE] Heartbeat push error, HTTP %d\n", httpCode);
  }

  http.end();
}

/**
 * Updates a single device record in Supabase if changed locally.
 * Endpoint: PATCH /rest/v1/devices?classroom_id=eq.{CLASSROOM_ID}&relay_channel=eq.{channel}
 */
void syncDeviceStateToSupabase(uint8_t channelIndex, bool state) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  configureSecureClient(client);
  HTTPClient http;

  int channel = channelIndex + 1;
  String url = String(SUPABASE_URL) + "/rest/v1/devices?classroom_id=eq." + String(CLASSROOM_ID) + "&relay_channel=eq." + String(channel);

  http.begin(client, url);
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal");

  float watts = state ? CHANNEL_DEFAULT_WATTAGE[channelIndex] : 0.0;

  StaticJsonDocument<128> doc;
  doc["status"]      = state ? "on" : "off";
  doc["power_usage"] = watts;

  String requestBody;
  serializeJson(doc, requestBody);

  http.PATCH(requestBody);
  http.end();
}
