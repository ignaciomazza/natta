import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { AUTH_COOKIE_NAME, signToken } from "@/lib/auth/jwt";
import { logServerError } from "@/lib/server/log";
import { checkRateLimit } from "@/lib/server/rate-limit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const runtime = "nodejs";

function getClientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = loginSchema.parse(await req.json());
    const rateLimit = checkRateLimit({
      key: `login:${getClientIp(req)}:${body.email.toLowerCase().trim()}`,
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos. Probá de nuevo en unos minutos." },
        {
          status: 429,
          headers: {
            "Retry-After": `${Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000)}`,
          },
        },
      );
    }

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
