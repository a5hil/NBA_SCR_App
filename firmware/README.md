# ESP32 Smart Classroom Controller Firmware

This firmware turns an **ESP32 (ESP32-WROOM-32 / ESP32 DevKit V1)** into an industrial-grade IoT controller for the **NBA Smart Classroom Management System**.

---

## 1. Hardware Overview & Wiring

### 1.1 Components Required
1. **ESP32 Development Board** (30-pin or 38-pin DevKit V1).
2. **8-Channel 5V Relay Module** with optocoupler isolation (Active LOW).
3. **DHT22 / DHT11** Temperature & Humidity Sensor.
4. **HC-SR501 or RCWL-0516** PIR Motion / Microwave Radar Sensor.
5. **5V 2A–3A DC Power Supply** (Dedicated power for relays to avoid ESP32 brownouts).
6. Optional: **ACS712 or CT Clamp Current Sensor** connected to GPIO 34.

---

### 1.2 Pin Connection Table

| Peripheral | Component Pin | ESP32 GPIO | Notes |
| :--- | :--- | :--- | :--- |
| **Relay Ch 1** (Lights 1) | IN1 | **GPIO 23** | Output (Active LOW) |
| **Relay Ch 2** (Lights 2) | IN2 | **GPIO 22** | Output (Active LOW) |
| **Relay Ch 3** (Fans) | IN3 | **GPIO 21** | Output (Active LOW) |
| **Relay Ch 4** (AC) | IN4 | **GPIO 19** | Output (Active LOW) |
| **Relay Ch 5** (Projector) | IN5 | **GPIO 18** | Output (Active LOW) |
| **Relay Ch 6** (Speakers) | IN6 | **GPIO 5** | Output (Active LOW) |
| **Relay Ch 7** (Outlets) | IN7 | **GPIO 4** | Output (Active LOW) |
| **Relay Ch 8** (Exhaust Fan) | IN8 | **GPIO 2** | Output (Active LOW) |
| **DHT22 Sensor** | DATA | **GPIO 15** | Pull-up 10k resistor to 3.3V |
| **PIR Sensor** | OUT | **GPIO 13** | Digital Input |
| **Current Sensor** (Optional) | OUT | **GPIO 34** | ADC1 input-only (Safe with Wi-Fi) |
| **Status LED** | Anode (+) | **GPIO 2** | Built-in Blue LED |

> [!WARNING]
> **Power Isolation**: Always connect the 5V power supply to the relay module's `JD-VCC` and `GND`, and remove the jumper between `VCC` and `JD-VCC` if you want optical isolation. Connect ESP32 `GND` to Relay module `GND` for shared ground reference.

---

## 2. Software & Library Setup

### 2.1 Arduino IDE Configuration
1. Install **Arduino IDE** (v2.x or later).
2. Add ESP32 Board URL in **File > Preferences > Additional Boards Manager URLs**:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Go to **Tools > Board > Boards Manager**, search for `esp32` and install `esp32 by Espressif Systems`.
4. Select board: **DOIT ESP32 DEVKIT V1** (or your specific ESP32 board).
5. Set **Upload Speed**: `921600` or `115200`.

### 2.2 Required Arduino Libraries
Open **Tools > Manage Libraries...** and install:
1. **ArduinoJson** by *Benoît Blanchon* (v6.x or v7.x).
2. **DHT sensor library** by *Adafruit*.
3. **Adafruit Unified Sensor** by *Adafruit*.

---

## 3. Configuration & Flashing

1. Open `firmware/esp32_smart_classroom/config.h`.
2. Configure your Wi-Fi credentials:
   ```cpp
   #define WIFI_SSID     "Your-WiFi-Network"
   #define WIFI_PASSWORD "Your-WiFi-Password"
   ```
3. Set your Supabase URL & Anon Key (from your `.env` or project settings):
   ```cpp
   #define SUPABASE_URL      "https://your-project-id.supabase.co"
   #define SUPABASE_ANON_KEY "your-anon-key"
   ```
4. Match the Classroom and Controller IDs to the ones in your database:
   ```cpp
   #define CLASSROOM_ID   "cls-a101"
   #define CONTROLLER_ID  "ctrl-a101"
   ```
5. Connect your ESP32 via USB and click **Upload**.
6. Open **Tools > Serial Monitor** at `115200 baud` to view the boot logs and IP address.

---

## 4. Local REST API Endpoints (Port 80)

The ESP32 runs a local HTTP server on port 80. You can query or control it directly on your LAN without going through the cloud:

### 4.1 Diagnostic Web Dashboard
Open your browser and navigate to:
```
http://<ESP32_IP>/
```
Displays live cards with room temperature, humidity, occupancy, electrical load, and relay states.

---

### 4.2 Get Full System Status (`GET /api/status`)
```bash
curl http://<ESP32_IP>/api/status
```
**Response:**
```json
{
  "controller_id": "ctrl-a101",
  "classroom_id": "cls-a101",
  "status": "online",
  "ip": "192.168.1.101",
  "mac": "24:6F:28:B2:1A:3C",
  "rssi": -58,
  "signal_strength": "strong",
  "firmware_version": "v1.0.0",
  "sensors": {
    "temperature": 24.2,
    "humidity": 52.4,
    "occupancy": "occupied",
    "current_load": 230.0
  },
  "relays": [
    { "channel": 1, "gpio": 23, "state": "on", "power": 80.0 },
    { "channel": 2, "gpio": 22, "state": "off", "power": 0.0 },
    ...
  ]
}
```

---

### 4.3 Control a Relay Channel (`POST /api/relay`)
Toggle a specific channel (1 to 8):
```bash
curl -X POST http://<ESP32_IP>/api/relay \
  -H "Content-Type: application/json" \
  -d '{"channel": 1, "state": "on"}'
```
**Response:**
```json
{
  "success": true,
  "channel": 1,
  "state": "on"
}
```

---

### 4.4 Emergency All-Off (`POST /api/emergency`)
Instantly shuts down all 8 relay channels:
```bash
curl -X POST http://<ESP32_IP>/api/emergency
```

---

## 5. Integration with Mobile App

1. In the **NBA Smart Classroom App**:
   - Navigate to **+ Add Classroom** wizard.
   - In Step 2 (*Controller Setup*), enter the IP assigned to your ESP32 (e.g. `192.168.1.101`).
2. When controlling devices in the app:
   - Toggling lights, fans, or ACs will update Supabase `devices`.
   - The ESP32 pulls the new state within 3 seconds and clicks the corresponding relay.
   - Live temperature and power usage from the ESP32 will automatically reflect on the classroom screen.
