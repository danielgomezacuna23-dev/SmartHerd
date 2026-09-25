import test from "node:test";
import assert from "node:assert/strict";
import { animalsWithoutCollar, suggestCollarId } from "../src/registration.mjs";

test("el primer collar físico usa su identificador real y los siguientes no lo duplican", () => {
  assert.equal(suggestCollarId([]), "SH-COLLAR-001");
  assert.equal(suggestCollarId([{ id: "SH-COLLAR-001" }]), "SH-COLLAR-002");
});

test("el formulario solo ofrece animales activos que aún no tienen collar", () => {
  const animals = [
    { id: "a", status: "activo" },
    { id: "b", status: "activo" },
    { id: "c", status: "vendido" },
  ];
  assert.deepEqual(animalsWithoutCollar(animals, [{ animal_id: "a" }]).map((animal) => animal.id), ["b"]);
});
