import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { createHandler } from "./handler.mjs";
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
Deno.serve(createHandler(db));
