import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { rows } = await pool.query(
    "select id, title, updated_at from conversations where user_id = $1 order by updated_at desc",
    [user.id],
  );

  return NextResponse.json({ conversations: rows });
}
