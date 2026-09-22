#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// =============================================================================
// 1. WI-FI NETWORK CONFIGURATION
// =============================================================================
#define WIFI_SSID           "IDEA LAB"          // Replace with campus/lab Wi-Fi SSID
#define WIFI_PASSWORD       "idea#fisat"      // Replace with Wi-Fi Password
#define WIFI_CONNECT_TIMEOUT_MS 20000                 // 20 seconds timeout for initial connection

// =============================================================================
// 2. SUPABASE BACKEND CONFIGURATION
// =============================================================================
// In your mobile app, check: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
#define SUPABASE_URL        "https://iynufzhopcrdadtluqnx.supabase.co" 
#define SUPABASE_ANON_KEY   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bnVmemhvcGNyZGFkdGx1cW54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNjMwOTEsImV4cCI6MjEwNDkzOTA5MX0.JqwsP1SB7gAHCFu_Ed60PU0MOmdPakFmD0KNtZMXqa4"

// Target Classroom & Controller IDs (Matching the database schema)
#define CLASSROOM_ID        "cls-a101"                // e.g. cls-a101, cls-a102, cls-seminar
#define CONTROLLER_ID       "ctrl-a101"               // e.g. ctrl-a101, ctrl-a102
#define CONTROLLER_NAME     "ESP32-A101"
#define FIRMWARE_VERSION    "v1.0.0"
#define TOTAL_RELAY_CHANNELS 8

// =============================================================================
// 3. HARDWARE GPIO PIN MAPPING (8-CHANNEL RELAY BOARD)
// =============================================================================
// Most 8-channel relay modules are Active LOW (LOW = Relay ON, HIGH = Relay OFF).
// If your relay module is Active HIGH, set this to false.
#define RELAY_ACTIVE_LOW    true

// Recommended ESP32 GPIO Pins for 8 Relays (Safe output pins on ESP32 DevKit):
// Avoid GPIO 0, 6-11 (flash memory), and 34-39 (input only).
const uint8_t RELAY_PINS[TOTAL_RELAY_CHANNELS] = {
  23, // Relay Ch 1: Ceiling Lights Row 1
  22, // Relay Ch 2: Ceiling Lights Row 2
  21, // Relay Ch 3: Ceiling Fans
  19, // Relay Ch 4: Air Conditioner (AC)
  18, // Relay Ch 5: Smart Projector / Display
  5,  // Relay Ch 6: Audio System / Speakers
  4,  // Relay Ch 7: Charging Outlets
  2   // Relay Ch 8: Exhaust Fan / Auxiliary
};

// Default rated power in Watts for each channel (used for load calculation)
const float CHANNEL_DEFAULT_WATTAGE[TOTAL_RELAY_CHANNELS] = {
  80.0,   // Ch 1: Lights Row 1 (80W)
  80.0,   // Ch 2: Lights Row 2 (80W)
  150.0,  // Ch 3: Fans (150W)
  1500.0, // Ch 4: AC (1500W)
  250.0,  // Ch 5: Projector (250W)
  60.0,   // Ch 6: Sound System (60W)
  120.0,  // Ch 7: Charging Outlets (120W)
  50.0    // Ch 8: Exhaust Fan (50W)
};

// =============================================================================
// 4. SENSORS PIN MAPPING & CONFIGURATION
// =============================================================================
// Temperature & Humidity Sensor (DHT11 or DHT22)
#define DHT_PIN             15
#define DHT_TYPE            DHT22     // Use DHT11 or DHT22

// PIR Motion / Occupancy Sensor (HC-SR501 or RCWL-0516)
#define PIR_PIN             13
#define OCCUPANCY_HOLD_SEC  60        // Keep room marked as "occupied" for 60s after motion

// Current Sensor (Optional Analog Sensor like ACS712-20A/30A or CT Clamp)
// Note: GPIO 34 is an ADC1 input-only pin, safe to use with WiFi
#define USE_PHYSICAL_CURRENT_SENSOR false
#define CURRENT_SENSOR_PIN  34
#define ACS_ZERO_CURRENT_MV 1650.0    // VCC/2 for 3.3V system or 2500 for 5V
#define ACS_SENSITIVITY_MV_A 100.0    // 100mV/A for ACS712-20A, 66mV/A for 30A, 185mV/A for 5A
#define MAINS_VOLTAGE       230.0     // AC mains voltage (e.g. 230V or 110V)

// Onboard Status LED
#define STATUS_LED_PIN      2         // Built-in blue LED on most ESP32 boards

// =============================================================================
// 5. TIMING & SYNC INTERVALS (Milliseconds)
// =============================================================================
#define SUPABASE_PULL_INTERVAL_MS   3000    // Pull device commands from Supabase every 3 sec
#define TELEMETRY_PUSH_INTERVAL_MS  10000   // Send temperature, load, occupancy every 10 sec
#define HEARTBEAT_PUSH_INTERVAL_MS  30000   // Update controller last_seen & status every 30 sec
#define SENSOR_READ_INTERVAL_MS     2500    // Read DHT sensor every 2.5 sec

// REST API Web Server Port
#define LOCAL_SERVER_PORT   80

#endif // CONFIG_H
