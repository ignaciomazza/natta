import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { AUTH_COOKIE_NAME, signToken } from "@/lib/auth/jwt";
import { logServerError } from "@/lib/server/log";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = loginSchema.parse(await req.json());
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase().trim() },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Credenciales invalidas" }, { status: 401 });
    }

    const isValidPassword = await verifyPassword(body.password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json({ error: "Credenciales invalidas" }, { status: 401 });
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
    });

    const response = NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    });
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    logServerError("api.auth.login.post", error);
    return NextResponse.json({ error: "No se pudo iniciar sesion" }, { status: 500 });
  }
}
