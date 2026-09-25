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
    await db.exec("create publication supabase_realtime;");
    for (const migration of ["202609250001_tracking_mode.sql", "202609250002_module_registry.sql"])
      await db.exec(readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"));
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
    await db.exec(`insert into tracking_mode(owner_id,interval_seconds,live_until) values ('${alice}',300,null)`);
    await db.exec(`insert into module_registry(owner_id,module_id,role,name,device_id) values ('${alice}','68EE8F4F3220','emisor','Collar 1','SH-COLLAR-001')`);
    await assert.rejects(() => db.exec(`insert into module_registry(owner_id,module_id,role,name,device_id) values ('${bob}','68EE8F4F5020','receptor','Otra finca',null)`));
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
    assert.equal((await db.query("select * from module_registry")).rows.length, 0);
    assert.equal((await db.query("select * from tracking_mode")).rows.length, 0);
    await db.exec(`set request.jwt.claim.sub='${alice}';`);
    assert.equal((await db.query("select * from telemetry")).rows.length, 1);
    await assert.rejects(() => db.exec(`update telemetry set activity=100`));
    await db.exec("reset role;set role anon;");
    await assert.rejects(() => db.query("select * from animals"));
    await db.exec("reset role;");
    await db.exec(readFileSync(new URL("../supabase/migrations/202609250003_multiple_farms.sql", import.meta.url), "utf8"));
    const migrated = (await db.query(`select farm_id from animals where id='${a}'`)).rows[0].farm_id;
    assert.equal((await db.query(`select farm_id from telemetry where animal_id='${a}'`)).rows[0].farm_id, migrated);
    assert.equal((await db.query(`select farm_id from tracking_mode where owner_id='${alice}'`)).rows[0].farm_id, migrated);
    const secondFarm = "00000000-0000-4000-8000-000000000005";
    await db.exec(`insert into farm_settings(id,owner_id,name,production_type,breeds,latitude,longitude) values ('${secondFarm}','${alice}','Segunda finca','engorde',array['Brahman'],10.0,-84.1)`);
    await db.exec(`insert into animals(owner_id,farm_id,name,ear_tag,breed,sex,purpose,birth_date) values ('${alice}','${secondFarm}','Luna','A-1','Brahman','hembra','engorde','2022-01-01')`);
    assert.equal((await db.query(`select * from animals where farm_id='${secondFarm}'`)).rows.length, 1);
    await assert.rejects(() => db.exec(`insert into devices(id,owner_id,farm_id,animal_id) values ('SH-CROSS-001','${alice}','${secondFarm}','${a}')`));
    await assert.rejects(() => db.exec(`insert into events(owner_id,farm_id,animal_id,type,date) values ('${alice}','${secondFarm}','${a}','revision',current_date)`));
    await db.exec(`insert into tracking_mode(owner_id,farm_id,interval_seconds) values ('${alice}','${secondFarm}',300)`);
    assert.equal((await db.query(`select * from tracking_mode where owner_id='${alice}'`)).rows.length, 2);
  } finally {
    await db.close();
  }
});
