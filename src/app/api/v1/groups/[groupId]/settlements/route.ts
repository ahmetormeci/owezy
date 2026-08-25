import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { createSettlement, listSettlements } from "@/lib/settlements";
import {
  createSettlementSchema,
  listSettlementsQuerySchema,
} from "@/lib/settlement-schemas";
import { handleApiError } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const { groupId } = await params;
    const searchParams = request.nextUrl.searchParams;

    const query = listSettlementsQuerySchema.parse({
      limit: searchParams.get("limit") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      includeCancelled: searchParams.get("includeCancelled") ?? undefined,
    });

    const { settlements, nextCursor } = await listSettlements(user.id, groupId, query);
    return NextResponse.json({ ok: true, settlements, nextCursor });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const { groupId } = await params;
    const body = createSettlementSchema.parse(await request.json());

    const settlement = await createSettlement(user.id, groupId, body);
    return NextResponse.json({ ok: true, settlement }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
