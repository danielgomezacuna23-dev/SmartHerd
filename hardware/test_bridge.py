import unittest

from bridge import identity_ok, parse_packet


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


if __name__ == "__main__":
    unittest.main()
