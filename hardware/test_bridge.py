import unittest

from bridge import identity_ok, parse_packet, accept_packet, snapshot, state
from unittest.mock import patch


class BridgeTest(unittest.TestCase):
    def test_module_identity_cannot_be_swapped(self):
        tx = "SHGPS_TX chip=20324F8FEE68 collar=SH-COLLAR-001 RADIO_READY=1"
        rx = "SHGPS_RX chip=20504F8FEE68 RADIO_READY=1"
        self.assertTrue(identity_ok(tx, "transmitter"))
        self.assertTrue(identity_ok(rx, "receiver"))
        self.assertFalse(identity_ok(tx, "receiver"))
        self.assertFalse(identity_ok(rx, "transmitter"))
        self.assertFalse(identity_ok(tx.replace("20324F8FEE68", "20504F8FEE68"), "transmitter"))

    def test_packet_requires_bound_collar_and_valid_position(self):
        self.assertEqual(parse_packet("SHRX|SH-COLLAR-001|2|NO_FIX|||-53|8.0")["signal"], "no_fix")
        self.assertEqual(parse_packet("SHRX|SH-COLLAR-001|3|FIX|10.0|-84.0|-55|7.0")["latitude"], 10.0)
        self.assertIsNone(parse_packet("SHRX|SH-COLLAR-002|3|FIX|10.0|-84.0|-55|7.0"))
        self.assertIsNone(parse_packet("SHRX|SH-COLLAR-001|3|FIX|NaN|-84.0|-55|7.0"))

    def test_battery_emitter_and_silence(self):
        frame = "SHRX3|SH-COLLAR-001|20324F8FEE68|ABCDEF01|1|NO_FIX|||-1|-1.00|-1|23|2345|6000|3|9600|-55|8.50"
        packet = parse_packet(frame)
        self.assertEqual(packet["signal"], "no_fix")
        with patch("bridge.time.monotonic", return_value=100), patch("bridge.find_port", return_value=None):
            state.update(receiver_connected=True, receiver_radio_ready=True)
            accept_packet(packet)
            self.assertTrue(snapshot(105)["transmitter_connected"])
            self.assertFalse(snapshot(105)["transmitter_usb_connected"])
            self.assertFalse(snapshot(116)["transmitter_connected"])
            state["receiver_connected"] = False
            self.assertFalse(snapshot(105)["transmitter_connected"])
        self.assertIsNone(parse_packet(frame.replace("20324F8FEE68", "20504F8FEE68")))
        self.assertIsNone(parse_packet(frame.replace("|3|9600|", "|300|9600|")))

    def test_gps_payload_and_reboot_identity(self):
        fix = "SHRX3|SH-COLLAR-001|20324F8FEE68|ABCDEF01|7|FIX|9.94|-84.1|8|1.20|100|50|4000|10000|3|9600|-55|8.50"
        self.assertEqual(parse_packet(fix)["satellites"], 8)
        self.assertEqual(parse_packet(fix)["latitude"], 9.94)
        self.assertIsNone(parse_packet(fix.replace("|9.94|", "|NaN|")))
        self.assertIsNone(parse_packet(fix.replace("|100|50|", "|16000|50|")))
        no_data = fix.replace("FIX|9.94|-84.1|8|1.20|100", "NO_DATA|||-1|-1.00|-1")
        self.assertEqual(parse_packet(no_data)["signal"], "no_data")
        reboot = parse_packet(fix.replace("ABCDEF01|7", "ABCDEF02|1"))
        self.assertNotEqual(parse_packet(fix)["boot_id"], reboot["boot_id"])


if __name__ == "__main__":
    unittest.main()
