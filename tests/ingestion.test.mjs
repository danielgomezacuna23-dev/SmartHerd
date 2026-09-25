import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createHandler } from "../supabase/functions/ingest-telemetry/handler.mjs";
const token = "a".repeat(64),
  hash = createHash("sha256").update(token).digest("hex");
function mockDatabase() {
  const stored = [];
  let tracking = null;
  return {
    stored,
    setTracking(value) { tracking = value; },
    from(table) {
      const filters = {};
      return {
        select() {
          return this;
        },
        eq(k, v) {
          filters[k] = v;
          return this;
        },
        async maybeSingle() {
          if (table === "gateway_credentials")
            return {
              data:
                filters.token_hash === hash ? { owner_id: "owner-1", farm_id: "farm-1" } : null,
            };
          if (table === "devices")
            return {
              data:
                filters.id === "SH-COLLAR-001" &&
                filters.owner_id === "owner-1" &&
                filters.farm_id === "farm-1" &&
                filters.enabled &&
                filters["animals.status"] === "activo"
                  ? {
                      id: "SH-COLLAR-001",
                      owner_id: "owner-1",
                      farm_id: "farm-1",
                      animal_id: "animal-1",
                    }
                  : null,
            };
          if (table === "tracking_mode")
            return { data: filters.owner_id === "owner-1" && filters.farm_id === "farm-1" ? tracking : null };
          throw Error("Tabla inesperada");
        },
        async insert(p) {
          if (stored.some((x) => x.packet_id === p.packet_id))
            return { error: { code: "23505" } };
          stored.push(p);
          return { error: null };
        },
      };
    },
  };
}
const packet = {
  device_id: "SH-COLLAR-001",
  packet_id: "p-1",
  recorded_at: new Date().toISOString(),
  temperature_c: 33,
  latitude: null,
  longitude: null,
  owner_id: "intruder",
};
const request = (body = packet, key = token, method = "POST") =>
  new Request("http://localhost/ingest", {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
test("HTTP: autentica estación, valida vínculo, ignora propietario del cliente y deduplica", async () => {
  const db = mockDatabase(),
    handle = createHandler(db);
  assert.equal((await handle(request())).status, 201);
  assert.equal(db.stored[0].owner_id, "owner-1");
  assert.equal(db.stored[0].farm_id, "farm-1");
  assert.equal(db.stored[0].animal_id, "animal-1");
  const duplicate = await handle(request());
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).duplicate, true);
  assert.equal(db.stored.length, 1);
  assert.equal((await handle(request(packet, "b".repeat(64)))).status, 401);
  assert.equal(
    (await handle(request({ ...packet, device_id: "SH-OTHER-001" }))).status,
    403,
  );
});
test("HTTP: rechaza método, formato, tamaño y valores inválidos sin guardar", async () => {
  const db = mockDatabase(),
    handle = createHandler(db);
  assert.equal((await handle(request(packet, token, "DELETE"))).status, 405);
  assert.equal((await handle(request(packet, "not-a-token"))).status, 401);
  assert.equal(
    (await handle(request({ ...packet, activity: 200 }))).status,
    400,
  );
  assert.equal(
    (await handle(request({ ...packet, notes: "x".repeat(5000) }))).status,
    413,
  );
  assert.equal(
    (
      await handle(
        new Request("http://localhost", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: "invalid",
        }),
      )
    ).status,
    400,
  );
  assert.equal(db.stored.length, 0);
});
test("HTTP: estación autenticada recibe modo habitual o rápido vigente", async () => {
  const db = mockDatabase(), handle = createHandler(db);
  assert.deepEqual(await (await handle(request(packet, token, "GET"))).json(), {
    interval_seconds: 300, live_until: null,
  });
  const liveUntil = new Date(Date.now() + 60_000).toISOString();
  db.setTracking({ interval_seconds: 5, live_until: liveUntil });
  assert.deepEqual(await (await handle(request(packet, token, "GET"))).json(), {
    interval_seconds: 5, live_until: liveUntil,
  });
  db.setTracking({ interval_seconds: 5, live_until: new Date(Date.now() - 60_000).toISOString() });
  assert.equal((await (await handle(request(packet, token, "GET"))).json()).interval_seconds, 300);
  assert.equal((await handle(request(packet, "b".repeat(64), "GET"))).status, 401);
});
