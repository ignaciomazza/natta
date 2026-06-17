import { SignJWT, jwtVerify } from "jose";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";

export type AuthPayload = {
  userId: string;
  email: string;
};

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  if (
    process.env.NODE_ENV === "production" &&
    (secret.length < 32 || secret === "reemplazar-con-secreto")
  ) {
    throw new Error("JWT_SECRET must be a strong production secret");
  }

  return new TextEncoder().encode(secret);
};

export async function signToken(
  payload: AuthPayload,
  expiresIn: string | number = "7d",
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret());
  if (typeof payload.userId !== "string" || typeof payload.email !== "string") {
    throw new Error("INVALID_TOKEN");
  }

  return {
    userId: payload.userId,
    email: payload.email,
  };
}

export { AUTH_COOKIE_NAME };
