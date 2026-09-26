import type { NextRequest } from "next/server";
import { registerUser } from "@ax-finance/domain";
import { json, errorResponse } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await registerUser(body);
    return json({ id: user.id, email: user.email, name: user.name }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
