import test from "node:test";
import assert from "node:assert/strict";
import { withDeadline } from "../src/deadline.mjs";

test("una carga de fincas bloqueada deja de mostrar el indicador y permite reintentar", async () => {
  let aborted = false;
  await assert.rejects(
    withDeadline(new Promise(() => {}), 20, () => { aborted = true; }),
    /tardó demasiado/,
  );
  assert.equal(aborted, true);
  assert.deepEqual(await withDeadline(Promise.resolve(["finca"]), 20), ["finca"]);
});
