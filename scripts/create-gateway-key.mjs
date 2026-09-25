import { randomBytes, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const owner = process.argv[2],
  farm = process.argv[3],
  file = process.argv[4];
if (!/^[0-9a-f-]{36}$/i.test(owner || "") || !/^[0-9a-f-]{36}$/i.test(farm || "") || !file) {
  console.error(
    "Uso: node scripts/create-gateway-key.mjs UUID_USUARIO UUID_FINCA /ruta/privada/estacion.env",
  );
  process.exit(1);
}
const token = randomBytes(32).toString("hex");
writeFileSync(file, `GATEWAY_TOKEN=${token}\n`, { mode: 0o600, flag: "wx" });
console.log(
  `Clave guardada en ${file}. Conserva ese archivo fuera del proyecto. SQL para registrar su hash:`,
);
console.log(
  `insert into public.gateway_credentials(owner_id, farm_id, token_hash) values ('${owner}', '${farm}', '${createHash("sha256").update(token).digest("hex")}');`,
);
