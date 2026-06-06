import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth/jwt";

export async function requireAuth(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    throw new Error("UNAUTHORIZED");
  }

  const payload = await verifyToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}
