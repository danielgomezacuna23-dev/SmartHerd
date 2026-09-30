#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>

namespace {
constexpr int kCs = 10, kReset = 16, kDio0 = 15, kGpsRx = 18;
constexpr uint32_t kIntervalMs = 3000, kGpsMaxAgeMs = 15000;
constexpr char kCollarId[] = "SH-COLLAR-001";
bool radioReady = false;
bool startRadio() {
  SPI.begin(12, 13, 11, kCs);
  LoRa.setPins(kCs, kReset, kDio0);
  LoRa.setSPIFrequency(1000000);
  if (!LoRa.begin(915000000)) return false;
  LoRa.setTxPower(2);
  LoRa.setSpreadingFactor(7);
  LoRa.setSignalBandwidth(125000);
  LoRa.setCodingRate4(5);
  LoRa.setPreambleLength(8);
  LoRa.setSyncWord(0x12);
  LoRa.enableCrc();
  return true;
}
#if defined(SH_GPS_TX)
char nmea[160] = {};
size_t nmeaLength = 0;
uint32_t gpsBytes = 0, validNmea = 0, lastNmea = 0, lastFix = 0;
uint32_t lastSend = 0, sequence = 0, bootId = 0, baudStarted = 0;
constexpr uint32_t kBauds[] = {9600, 4800, 38400, 115200};
size_t baudIndex = 0;
bool hasFix = false;
double latitude = 0, longitude = 0, hdop = -1;
int satellites = -1;
bool checksumOK(const char *line) {
  if (line[0] != '$') return false;
  const char *star = strchr(line, '*');
  if (!star || !star[1] || !star[2]) return false;
  uint8_t sum = 0;
  for (const char *p = line + 1; p < star; ++p) sum ^= uint8_t(*p);
  char expected[3]; snprintf(expected, sizeof(expected), "%02X", sum);
  return toupper(star[1]) == expected[0] && toupper(star[2]) == expected[1];
}
bool coordinate(const char *raw, char hemi, double &out) {
  if (!*raw || !strchr("NSEW", hemi) || !hemi) return false;
  char *end;
  double value = strtod(raw, &end);
  if (*end || !isfinite(value) || value < 0) return false;
  int degrees = int(value / 100);
  double minutes = value - degrees * 100;
  if (minutes >= 60) return false;
  out = degrees + minutes / 60;
  if (hemi == 'S' || hemi == 'W') out = -out;
  return true;
}
void processNmea() {
  if (!checksumOK(nmea)) return;
  ++validNmea; lastNmea = millis();
  char *fields[20] = {nmea}; int count = 1;
  // Preserve empty NMEA fields: an invalid fix commonly has no coordinates.
  for (char *p = nmea; *p; ++p) {
    if (*p == '*') { *p = 0; break; }
    if (*p == ',') { *p = 0; if (count < 20) fields[count++] = p + 1; }
  }
  if ((!strcmp(fields[0], "$GPRMC") || !strcmp(fields[0], "$GNRMC")) && count >= 7) {
    double lat, lon;
    hasFix = fields[2][0] == 'A' && strchr("NS", fields[4][0]) && fields[4][0] &&
      strchr("EW", fields[6][0]) && fields[6][0] &&
      coordinate(fields[3], fields[4][0], lat) && coordinate(fields[5], fields[6][0], lon) &&
      fabs(lat) <= 90 && fabs(lon) <= 180;
    if (hasFix) { latitude = lat; longitude = lon; lastFix = millis(); }
  }
  if ((!strcmp(fields[0], "$GPGGA") || !strcmp(fields[0], "$GNGGA")) && count >= 9) {
    satellites = *fields[7] ? atoi(fields[7]) : -1;
    hdop = *fields[8] ? atof(fields[8]) : -1;
    if (atoi(fields[6]) == 0) hasFix = false;
  }
}
void readGps() {
  while (Serial1.available()) {
    char c = Serial1.read(); ++gpsBytes;
    if (c == '$') nmeaLength = 0;
    if (c == '\n') { nmea[nmeaLength] = 0; processNmea(); nmeaLength = 0; }
    else if (c != '\r' && nmeaLength < sizeof(nmea) - 1) nmea[nmeaLength++] = c;
  }
}
void identify() {
  Serial.printf("SHGPS_TX chip=%012llX collar=%s RADIO_READY=%d interval=3 firmware=expo3\n", ESP.getEfuseMac(), kCollarId, radioReady);
}
void transmit() {
  bool data = validNmea && millis() - lastNmea <= kGpsMaxAgeMs;
  bool fix = data && hasFix && millis() - lastFix <= kGpsMaxAgeMs;
  char lat[24] = "", lon[24] = "", packet[240];
  if (fix) { snprintf(lat, sizeof(lat), "%.6f", latitude); snprintf(lon, sizeof(lon), "%.6f", longitude); }
  snprintf(packet, sizeof(packet), "SHGPS3|%s|%012llX|%08lX|%lu|%s|%s|%s|%d|%.2f|%ld|%lu|%lu|%lu|3|%lu",
    kCollarId, ESP.getEfuseMac(), bootId, ++sequence, fix ? "FIX" : (data ? "NO_FIX" : "NO_DATA"), lat, lon,
    data ? satellites : -1, data ? hdop : -1, fix ? long(millis() - lastFix) : -1L,
    validNmea, gpsBytes, millis(), kBauds[baudIndex]);
  if (LoRa.beginPacket()) {
    LoRa.print(packet); LoRa.endPacket(true);
    Serial.printf("TX %s\n", packet);
  }
}
#elif defined(SH_BASE_RX)
// The library remains in continuous RX. The ISR only copies a bounded frame;
// USB output and validation happen in loop(), never in the interrupt.
char rxBuffer[256];
volatile bool rxPending = false;
volatile int rxLength = 0, rxRssi = 0;
volatile float rxSnr = 0;
void onReceive(int length) {
  if (length <= 0 || length > 230 || rxPending) {
    while (LoRa.available()) LoRa.read();
    return;
  }
  int index = 0;
  while (LoRa.available() && index < 230) rxBuffer[index++] = LoRa.read();
  rxBuffer[index] = 0; rxLength = index;
  rxRssi = LoRa.packetRssi(); rxSnr = LoRa.packetSnr();
  rxPending = true;
}
void identify() {
  Serial.printf("SHGPS_RX chip=%012llX RADIO_READY=%d firmware=expo3 continuous_rx=1\n", ESP.getEfuseMac(), radioReady);
}
#else
#error "Select gps_tx or base_rx"
#endif
}
void setup() {
  Serial.begin(115200);
  // Battery operation must never wait for a USB host.
  delay(300);
  radioReady = startRadio();
#if defined(SH_GPS_TX)
  bootId = esp_random();
  Serial1.begin(9600, SERIAL_8N1, kGpsRx, -1);
  baudStarted = millis(); lastSend = millis();
#else
  if (radioReady) { LoRa.onReceive(onReceive); LoRa.receive(); }
#endif
  identify();
}
void loop() {
  while (Serial.available()) if (Serial.read() == 'I') identify();
#if defined(SH_GPS_TX)
  readGps();
  if (!validNmea && millis() - baudStarted >= 8000) {
    Serial1.end(); baudIndex = (baudIndex + 1) % 4;
    Serial1.begin(kBauds[baudIndex], SERIAL_8N1, kGpsRx, -1);
    nmeaLength = 0; baudStarted = millis();
  }
  if (millis() - lastSend >= kIntervalMs) {
    lastSend += kIntervalMs;
    if (radioReady) transmit();
  }
#else
  if (rxPending) {
    char packet[256]; int rssi; float snr;
    noInterrupts();
    memcpy(packet, rxBuffer, rxLength + 1); rssi = rxRssi; snr = rxSnr; rxPending = false;
    interrupts();
    if (!strncmp(packet, "SHGPS3|", 7)) Serial.printf("SHRX3|%s|%d|%.2f\n", packet + 7, rssi, snr);
  }
#endif
  delay(1);
}
