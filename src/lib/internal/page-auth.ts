import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth/jwt";

export async function requirePageAuth() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/interno/login");
  }

  try {
    const payload = await verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, isActive: true },
    });

    if (!user || !user.isActive) {
      redirect("/interno/login");
    }

    return user;
  } catch {
    redirect("/interno/login");
  }
}
