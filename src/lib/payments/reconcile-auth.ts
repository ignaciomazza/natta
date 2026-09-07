import crypto from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export const reconciliationAudience =
  "https://www.nattavascas.com/api/payments/reconcile";
const githubKeys = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
);

export function isReconciliationWorkflow(payload: JWTPayload) {
  return (
    payload.repository === "ignaciomazza/natta" &&
    payload.repository_id === "1230336805" &&
    payload.ref === "refs/heads/main" &&
    payload.sub === "repo:ignaciomazza/natta:ref:refs/heads/main" &&
    payload.workflow_ref ===
      "ignaciomazza/natta/.github/workflows/reconcile-payments.yml@refs/heads/main" &&
    (payload.event_name === "schedule" ||
      payload.event_name === "workflow_dispatch")
  );
}

export async function canReconcilePayments(authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) return false;
  const token = authorization.slice(7);
  const secret = process.env.CRON_SECRET;
  if (
    secret &&
    Buffer.byteLength(token) === Buffer.byteLength(secret) &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  )
    return true;
  try {
    const { payload } = await jwtVerify(token, githubKeys, {
      issuer: "https://token.actions.githubusercontent.com",
      audience: reconciliationAudience,
      algorithms: ["RS256"],
      maxTokenAge: "10 minutes",
    });
    return isReconciliationWorkflow(payload);
  } catch {
    return false;
  }
}
