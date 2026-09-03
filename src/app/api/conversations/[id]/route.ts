import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

async function requireOwnedConversation(userId: string, conversationId: string) {
  const { rowCount } = await pool.query(
    "select 1 from conversations where id = $1 and user_id = $2",
    [conversationId, userId],
  );
  return rowCount !== 0;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!(await requireOwnedConversation(user.id, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { rows } = await pool.query(
    "select role, content from messages where conversation_id = $1 order by created_at asc",
    [id],
  );

  return NextResponse.json({ messages: rows });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await pool.query("delete from conversations where id = $1 and user_id = $2", [
    id,
    user.id,
  ]);

  return NextResponse.json({ ok: true });
}
