import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { handleRpcA } from "@/server/rpc-a";
import { handleRpcB } from "@/server/rpc-b";

const A_OPS = new Set([
  "signup",
  "login",
  "logout",
  "resetRequest",
  "resetConfirm",
  "meta",
  "list",
  "create",
  "update",
  "delete"
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const op = body?.op;

    if (!op || typeof op !== "string") {
      throw new ApiError(400, "op is required");
    }

    const result = A_OPS.has(op) ? await handleRpcA(op, body) : await handleRpcB(op, body);

    return NextResponse.json(result ?? { ok: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation error",
          issues: error.errors
        },
        { status: 400 }
      );
    }

    console.error(error);

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}