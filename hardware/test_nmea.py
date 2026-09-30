"""Exercise the actual firmware NMEA parser on the host, without any ESP32."""
import pathlib
import subprocess
import tempfile
import unittest


class NmeaTest(unittest.TestCase):
    def test_fix_loss_empty_fields_checksum_and_equator(self):
        source = (pathlib.Path(__file__).parent / 'src/main.cpp').read_text()
        parser = source[source.index('char nmea[160]'):source.index('void readGps()')]
        harness = r'''
#include <cmath>
#include <cstring>
#include <cstdio>
#include <cstdlib>
#include <cstdint>
#include <cctype>
#include <cassert>
using std::isfinite;
uint32_t millis() { return 10000; }
'''+parser+r'''
void feed(const char *body) {
  unsigned char sum = 0;
  for (const char *p = body; *p; ++p) sum ^= *p;
  snprintf(nmea, sizeof(nmea), "$%s*%02X", body, sum);
  processNmea();
}
int main() {
  feed("GPRMC,123519,A,0956.400,N,08406.000,W,0,0,300926,,");
  assert(hasFix && fabs(latitude - 9.94) < 0.000001 && fabs(longitude + 84.1) < 0.000001);
  feed("GPRMC,123520,V,,,,,,,300926,,");
  assert(!hasFix); // Empty coordinates must not hide loss of satellite fix.
  feed("GPRMC,123521,A,0000.000,N,00000.000,E,0,0,300926,,");
  assert(hasFix && latitude == 0 && longitude == 0);
  feed("GPGGA,123521,0000,N,00000,E,1,08,1.2,0,M,0,M,,");
  assert(satellites == 8 && hdop == 1.2);
  feed("GPGGA,123522,,,,,0,00,99.9,,,,,,");
  assert(!hasFix && satellites == 0);
  feed("GPRMC,123523,A,NaN,N,08406.000,W,0,0,300926,,");
  assert(!hasFix);
  auto before = validNmea;
  strcpy(nmea, "$GPRMC,123524,A,0956.400,N,08406.000,W,0,0,300926,,*00");
  processNmea(); assert(validNmea == before && !hasFix);
}
'''
        with tempfile.TemporaryDirectory() as temporary:
            cpp = pathlib.Path(temporary) / 'nmea.cpp'
            binary = pathlib.Path(temporary) / 'nmea'
            cpp.write_text(harness)
            subprocess.run(['clang++', '-std=c++17', str(cpp), '-o', str(binary)], check=True)
            subprocess.run([str(binary)], check=True)


if __name__ == '__main__':
    unittest.main()
