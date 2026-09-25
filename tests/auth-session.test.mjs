import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldResetWorkspace } from "../src/authSession.mjs";

test("retomar la pestaña conserva la finca cuando Supabase confirma la misma sesión", () => {
  for (const event of ["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED", "INITIAL_SESSION"])
    assert.equal(shouldResetWorkspace("user-1", "user-1", event), false);
});

test("cerrar sesión o cambiar de cuenta limpia la finca activa", () => {
  assert.equal(shouldResetWorkspace("user-1", null, "SIGNED_OUT"), true);
  assert.equal(shouldResetWorkspace("user-1", "user-2", "SIGNED_IN"), true);
  assert.equal(shouldResetWorkspace(null, "user-1", "SIGNED_IN"), true);
  assert.equal(shouldResetWorkspace("user-1", null, "TOKEN_REFRESHED"), false);
  assert.equal(shouldResetWorkspace("user-1", null, "INITIAL_SESSION"), false);
});
