import { z } from "zod";

const identifier = z.union([
  z.string().trim().min(1).max(180),
  z.number().int().nonnegative().refine(Number.isSafeInteger).transform(String),
]);

export const mercadoPagoNotificationSchema = z.object({
  id: identifier.optional(),
  action: z.string().max(100).optional(),
  type: z.string().max(100).optional(),
  topic: z.string().max(100).optional(),
  live_mode: z.boolean().optional(),
  data: z.object({ id: identifier }).optional(),
  resource: z.string().max(500).optional(),
});

export function getNotificationResourceId(
  payload: z.infer<typeof mercadoPagoNotificationSchema>,
  queryId: string | null,
) {
  const bodyId = payload.data?.id ?? null;
  if (bodyId && queryId && bodyId.toLowerCase() !== queryId.toLowerCase()) {
    throw new Error("NOTIFICATION_RESOURCE_MISMATCH");
  }
  return queryId ?? bodyId;
}
