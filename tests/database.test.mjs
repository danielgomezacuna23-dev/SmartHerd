import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("migración, aislamiento de fincas, escritura de telemetría y deduplicación", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
    );
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/202609160001_initial.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const alice = "00000000-0000-4000-8000-000000000001",
      bob = "00000000-0000-4000-8000-000000000002",
      a = "00000000-0000-4000-8000-000000000003",
      b = "00000000-0000-4000-8000-000000000004";
    await db.exec(
      `insert into auth.users values ('${alice}'),('${bob}');insert into animals(id,owner_id,name,ear_tag,breed,sex,purpose,birth_date) values ('${a}','${alice}','Estrella','A-1','Holstein','hembra','leche','2022-01-01'),('${b}','${bob}','Canela','B-1','Jersey','hembra','leche','2022-01-01');set role authenticated;set request.jwt.claim.sub='${alice}';`,
    );
    assert.equal((await db.query("select * from animals")).rows.length, 1);
    await assert.rejects(() =>
      db.exec(
        `insert into devices(id,owner_id,animal_id) values ('SH-BAD-001','${alice}','${b}')`,
      ),
    );
    await assert.rejects(() =>
      db.exec(
        `insert into animals(owner_id,name,ear_tag,breed,sex,purpose,birth_date) values('${bob}','Intruso','X','X','macho','engorde','2022-01-01')`,
      ),
    );
    await db.exec(
      `insert into devices(id,owner_id,animal_id) values ('SH-COLLAR-001','${alice}','${a}')`,
    );
    await assert.rejects(() => db.query("select * from gateway_credentials"));
    const insert = `insert into telemetry(owner_id,device_id,animal_id,packet_id,recorded_at,activity) values('${alice}','SH-COLLAR-001','${a}','p-1',now(),25)`;
    await assert.rejects(() => db.exec(insert));
    await db.exec("reset role;set role service_role;");
    await db.exec(insert);
    await assert.rejects(() => db.exec(insert));
    await db.exec(
      `reset role;set role authenticated;set request.jwt.claim.sub='${bob}';`,
    );
    assert.equal((await db.query("select * from telemetry")).rows.length, 0);
    await db.exec(`set request.jwt.claim.sub='${alice}';`);
    assert.equal((await db.query("select * from telemetry")).rows.length, 1);
    await assert.rejects(() => db.exec(`update telemetry set activity=100`));
    await db.exec("reset role;set role anon;");
    await assert.rejects(() => db.query("select * from animals"));
  } finally {
    await db.close();
  }
});
