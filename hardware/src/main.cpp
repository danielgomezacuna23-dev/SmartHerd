#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>

namespace {
constexpr int kCs = 10, kReset = 16, kDio0 = 15, kGpsRx = 18;
constexpr uint32_t kFrequency = 915000000;
constexpr uint32_t kNormalIntervalMs = 300000;
constexpr uint32_t kFastIntervalMs = 5000;
constexpr uint32_t kFixMaxAgeMs = 15000;
constexpr uint32_t kListenPeriodMs = 10000;
constexpr uint32_t kListenWindowMs = 2000;
constexpr char kCollarId[] = "SH-COLLAR-001";
bool radioReady = false;

bool startRadio() {
  SPI.begin(12, 13, 11, kCs);
  LoRa.setPins(kCs, kReset, kDio0);
  LoRa.setSPIFrequency(1000000);
  if (!LoRa.begin(kFrequency)) return false;
  LoRa.setTxPower(2);
  LoRa.setSpreadingFactor(7);
  LoRa.setSignalBandwidth(125000);
  LoRa.setCodingRate4(5);
  LoRa.setPreambleLength(8);
  LoRa.setSyncWord(0x12);
  LoRa.enableCrc();
  return true;
}

bool checksumOK(const char *line) {
  if (!line || line[0] != '$') return false;
  const char *star = strchr(line, '*');
  if (!star || !star[1] || !star[2]) return false;
  uint8_t sum = 0;
  for (const char *p = line + 1; p < star; ++p) sum ^= uint8_t(*p);
  char expected[3];
  snprintf(expected, sizeof(expected), "%02X", sum);
  return toupper(star[1]) == expected[0] && toupper(star[2]) == expected[1];
}

bool coordinate(const char *raw, char hemisphere, double &out) {
  if (!raw || !*raw) return false;
  const double value = atof(raw);
  if (value <= 0) return false;
  const int degrees = int(value / 100.0);
  const double minutes = value - degrees * 100.0;
  if (minutes < 0 || minutes >= 60) return false;
  out = degrees + minutes / 60.0;
  if (hemisphere == 'S' || hemisphere == 'W') out = -out;
  return true;
}

#if defined(SH_GPS_TX)
char nmea[120] = {};
size_t nmeaLength = 0;
double latitude = 0, longitude = 0;
uint32_t lastFix = 0, sequence = 0, lastSend = 0;
uint32_t gpsBytes = 0, validRmc = 0;
uint32_t fastUntil = 0, lastListenStart = 0;
bool fastMode = false, radioListening = false;
constexpr uint32_t kGpsBauds[] = {9600, 4800, 38400, 115200};
size_t baudIndex = 0;
uint32_t baudStarted = 0;
bool hasFix = false;

void processNmea() {
  if (!checksumOK(nmea)) return;
  if (strncmp(nmea, "$GPRMC,", 7) && strncmp(nmea, "$GNRMC,", 7)) return;
  ++validRmc;
  char copy[sizeof(nmea)];
  strncpy(copy, nmea, sizeof(copy)); copy[sizeof(copy) - 1] = 0;
  char *fields[9] = {};
  char *save = nullptr;
  for (int i = 0; i < 9; ++i) {
    fields[i] = strtok_r(i == 0 ? copy : nullptr, ",", &save);
    if (!fields[i]) return;
  }
  if (fields[2][0] != 'A') { hasFix = false; return; }
  double lat, lon;
  if (!coordinate(fields[3], fields[4][0], lat) ||
      !coordinate(fields[5], fields[6][0], lon) ||
      fabs(lat) > 90 || fabs(lon) > 180) return;
  latitude = lat; longitude = lon;
  hasFix = true; lastFix = millis();
}

void readGps() {
  while (Serial1.available()) {
    const char c = char(Serial1.read());
    ++gpsBytes;
    if (c == '\n') {
      nmea[nmeaLength] = 0;
      processNmea();
      nmeaLength = 0;
    } else if (c != '\r') {
      if (nmeaLength < sizeof(nmea) - 1) nmea[nmeaLength++] = c;
      else nmeaLength = 0;
    }
  }
}

bool decimalInRange(const String &value, uint32_t minimum, uint32_t maximum, uint32_t &parsed) {
  if (value.length() == 0 || value.length() > 4) return false;
  for (size_t i = 0; i < value.length(); ++i)
    if (!isDigit(value[i])) return false;
  parsed = static_cast<uint32_t>(value.toInt());
  return parsed >= minimum && parsed <= maximum;
}

void acceptControl(const String &payload) {
  const String prefix = String("SHCTRL1|") + kCollarId + "|";
  if (!payload.startsWith(prefix)) return;
  const String command = payload.substring(prefix.length());
  const int separator = command.indexOf('|');
  if (separator < 0 || command.indexOf('|', separator + 1) >= 0) return;
  const String intervalText = command.substring(0, separator);
  const String ttlText = command.substring(separator + 1);
  uint32_t ttl = 0;
  if (intervalText == "5" && decimalInRange(ttlText, 1, 900, ttl)) {
    const bool enteringFastMode = !fastMode;
    fastMode = true;
    fastUntil = millis() + ttl * 1000u;
    if (enteringFastMode) {
      lastSend = millis() - kFastIntervalMs;
      Serial.printf("MODE interval=5 ttl=%lu source=lora\n", ttl);
    }
  } else if (intervalText == "300" && ttlText == "0") {
    const bool leavingFastMode = fastMode;
    fastMode = false;
    fastUntil = 0;
    if (leavingFastMode) {
      lastSend = millis();
      Serial.println("MODE interval=300 source=lora");
    }
  }
}

void pollControl() {
  if (!radioReady) return;
  const uint32_t now = millis();
  if (fastMode && static_cast<int32_t>(now - fastUntil) >= 0) {
    fastMode = false;
    fastUntil = 0;
    lastSend = now;
    Serial.println("MODE interval=300 source=timeout");
  }
  if (now - lastListenStart >= kListenPeriodMs) lastListenStart = now;
  const bool shouldListen = fastMode || now - lastListenStart < kListenWindowMs;
  if (shouldListen != radioListening) {
    if (shouldListen) LoRa.receive();
    else LoRa.sleep();
    radioListening = shouldListen;
  }
  if (!radioListening) return;
  const int length = LoRa.parsePacket();
  if (length <= 0) return;
  if (length > 90) { while (LoRa.available()) LoRa.read(); return; }
  String payload;
  while (LoRa.available()) payload += char(LoRa.read());
  acceptControl(payload);
}
#elif defined(SH_BASE_RX)
char serialCommand[48] = {};
size_t serialCommandLength = 0;
String controlPayload;
uint32_t controlStarted = 0, lastControlSent = 0;
bool controlPending = false;

void beginControl(const char *line) {
  if (strcmp(line, "M|300|0") == 0) {
    controlPayload = String("SHCTRL1|") + kCollarId + "|300|0";
  } else if (strncmp(line, "M|5|", 4) == 0) {
    const char *number = line + 4;
    if (!*number || strlen(number) > 3) return;
    for (const char *p = number; *p; ++p) if (!isdigit(*p)) return;
    const int ttl = atoi(number);
    if (ttl < 1 || ttl > 900) return;
    controlPayload = String("SHCTRL1|") + kCollarId + "|5|" + String(ttl);
  } else return;
  controlStarted = millis();
  lastControlSent = controlStarted - 700u;
  controlPending = true;
  Serial.printf("CTRL_QUEUED %s\n", controlPayload.c_str());
}

void pollSerialCommand() {
  while (Serial.available()) {
    const char c = char(Serial.read());
    if (c == '\n' || c == '\r') {
      serialCommand[serialCommandLength] = 0;
      if (strcmp(serialCommand, "I") == 0)
        Serial.printf("SHGPS_RX chip=%012llX RADIO_READY=%d\n", ESP.getEfuseMac(), radioReady);
      else beginControl(serialCommand);
      serialCommandLength = 0;
    } else if (serialCommandLength < sizeof(serialCommand) - 1) {
      serialCommand[serialCommandLength++] = c;
    } else serialCommandLength = 0;
  }
}

void sendControl() {
  if (!radioReady || !controlPending) return;
  const uint32_t now = millis();
  if (now - controlStarted >= 20000) { controlPending = false; return; }
  if (now - lastControlSent < 700) return;
  lastControlSent = now;
  LoRa.idle();
  if (!LoRa.beginPacket()) { LoRa.receive(); return; }
  LoRa.print(controlPayload);
  LoRa.endPacket();
  LoRa.receive();
  Serial.printf("CTRL_TX %s\n", controlPayload.c_str());
}
#endif
}  // namespace

void setup() {
  Serial.begin(115200);
  delay(1200);
#if defined(SH_GPS_TX)
  Serial1.begin(9600, SERIAL_8N1, kGpsRx, -1);
  baudStarted = millis();
  lastSend = millis() - (kNormalIntervalMs - 10000u);
  lastListenStart = millis();
  Serial.printf("SHGPS_TX chip=%012llX gps_rx=%d\n", ESP.getEfuseMac(), kGpsRx);
#elif defined(SH_BASE_RX)
  Serial.printf("SHGPS_RX chip=%012llX\n", ESP.getEfuseMac());
#else
#error "Select gps_tx or base_rx"
#endif
  radioReady = startRadio();
  Serial.printf("RADIO_READY=%d frequency=%lu sf=7 bw=125000 crc=on\n", radioReady, kFrequency);
  if (radioReady) {
#if defined(SH_BASE_RX)
    LoRa.receive();
#else
    LoRa.receive();
    radioListening = true;
#endif
  }
}

void loop() {
#if defined(SH_GPS_TX)
  while (Serial.available()) {
    if (Serial.read() == 'I')
      Serial.printf("SHGPS_TX chip=%012llX collar=%s RADIO_READY=%d interval=%lu gps_bytes=%lu valid_rmc=%lu\n",
                    ESP.getEfuseMac(), kCollarId, radioReady,
                    fastMode ? 5ul : 300ul, gpsBytes, validRmc);
  }
#else
  pollSerialCommand();
#endif
#if defined(SH_GPS_TX)
  readGps();
  if (validRmc == 0 && millis() - baudStarted >= 8000) {
    Serial1.end();
    baudIndex = (baudIndex + 1) % (sizeof(kGpsBauds) / sizeof(kGpsBauds[0]));
    Serial1.begin(kGpsBauds[baudIndex], SERIAL_8N1, kGpsRx, -1);
    baudStarted = millis();
    nmeaLength = 0;
    Serial.printf("GPS_SCAN baud=%lu gpio=%d bytes=%lu valid_rmc=%lu\n",
                  kGpsBauds[baudIndex], kGpsRx, gpsBytes, validRmc);
  }
  pollControl();
  const uint32_t interval = fastMode ? kFastIntervalMs : kNormalIntervalMs;
  if (!radioReady || millis() - lastSend < interval) { delay(10); return; }
  lastSend = millis();
  const bool fix = hasFix && millis() - lastFix < kFixMaxAgeMs;
  const uint32_t number = ++sequence;
  String payload = "SHGPS2|" + String(kCollarId) + "|" + String(number) +
                   (fix ? "|FIX|" : "|NO_FIX|");
  if (fix) payload += String(latitude, 6) + "|" + String(longitude, 6);
  LoRa.idle();
  if (!LoRa.beginPacket()) { Serial.println("TX_ERROR beginPacket"); radioListening = false; return; }
  LoRa.print(payload);
  LoRa.endPacket();
  LoRa.sleep();
  radioListening = false;
  Serial.printf("TX seq=%lu status=%s gps_bytes=%lu valid_rmc=%lu payload=%s\n",
                number, fix ? "FIX" : "NO_FIX", gpsBytes, validRmc, payload.c_str());
#else
  if (!radioReady) { delay(250); return; }
  sendControl();
  const int packetSize = LoRa.parsePacket();
  if (packetSize <= 0) { delay(10); return; }
  if (packetSize > 90) { while (LoRa.available()) LoRa.read(); return; }
  String payload;
  while (LoRa.available()) payload += char(LoRa.read());
  if (!payload.startsWith("SHGPS2|")) return;
  const int idEnd = payload.indexOf('|', 7);
  const int first = payload.indexOf('|', idEnd + 1);
  const int second = payload.indexOf('|', first + 1);
  if (idEnd < 8 || first <= idEnd + 1 || second < 0) return;
  const String collarId = payload.substring(7, idEnd);
  if (collarId != kCollarId) return;
  const String sequence = payload.substring(idEnd + 1, first);
  const String status = payload.substring(first + 1, second);
  if (status == "NO_FIX")
    Serial.printf("SHRX|%s|%s|NO_FIX|||%d|%.1f\n", collarId.c_str(), sequence.c_str(), LoRa.packetRssi(), LoRa.packetSnr());
  else if (status == "FIX") {
    const String coordinates = payload.substring(second + 1);
    const int separator = coordinates.indexOf('|');
    if (separator < 0) return;
    Serial.printf("SHRX|%s|%s|FIX|%s|%s|%d|%.1f\n", collarId.c_str(), sequence.c_str(),
                  coordinates.substring(0, separator).c_str(),
                  coordinates.substring(separator + 1).c_str(),
                  LoRa.packetRssi(), LoRa.packetSnr());
  }
#endif
}
