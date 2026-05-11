import { NextResponse } from "next/server";

const SUPABASE_ENABLED = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY && process.env.ACCOUNT_KEY);

// GET /api/credits — devuelve el saldo actual
export async function GET() {
  // Sin Supabase configurado → modo libre (sin créditos)
  if (!SUPABASE_ENABLED) {
    return NextResponse.json({ credits: null, mode: "free" });
  }

  const { getSupabase } = await import("@/lib/supabase");
  const supabase = getSupabase();
  const ACCOUNT_KEY = process.env.ACCOUNT_KEY!;

  const { data, error } = await supabase
    .from("accounts")
    .select("credits, total_generated, name")
    .eq("account_key", ACCOUNT_KEY)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    credits: data.credits,
    total_generated: data.total_generated,
    name: data.name,
  });
}

