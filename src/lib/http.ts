import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { authErrorStatus, isAuthError } from "@/lib/auth/errors";

export async function parseJsonBody<T>(req: Request, fallback: T): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return fallback;
  }
}

export function apiErrorResponse(error: unknown, scope: string) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Datos invalidos", details: error.flatten() },
      { status: 400 },
    );
  }

  if (isAuthError(error)) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: authErrorStatus(error) },
    );
  }

  console.error(`[${scope}]`, error);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
