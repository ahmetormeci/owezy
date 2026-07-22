import { NextResponse } from "next/server";
import { getOrCreateCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getOrCreateCurrentUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, user });
}
