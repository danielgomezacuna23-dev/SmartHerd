import test from "node:test";
import assert from "node:assert/strict";
import { normalizeModuleId, validateModule } from "../src/modules.mjs";

test("identidad física estable distingue emisor y receptor", () => {
  assert.equal(normalizeModuleId("68:ee:8f:4f:32:20"), "68EE8F4F3220");
  const devices = [{ id: "SH-COLLAR-001" }];
  const emitter = validateModule({ module_id: "68:ee:8f:4f:32:20", role: "emisor", name: "Collar uno", device_id: "SH-COLLAR-001" }, devices, []);
  assert.equal(emitter.device_id, "SH-COLLAR-001");
  const receiver = validateModule({ module_id: "68:ee:8f:4f:50:20", role: "receptor", name: "Hub" }, devices, [emitter]);
  assert.equal(receiver.device_id, null);
  assert.throws(() => validateModule({ ...emitter, module_id: receiver.module_id }, devices, [receiver]), /registrado/);
  assert.throws(() => validateModule({ ...emitter, module_id: "68EE8F4F3221" }, devices, [emitter]), /emisor/);
});
