import { z } from "zod";

// Keep this contract identical to Natta's integrations/cobots-contract.ts.
export const nattaOrderActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("COLLECT_BALANCE"),
    amountArs: z.number().int().positive().max(2_000_000_000),
    method: z.enum(["CASH", "TRANSFER"]),
    referenceNote: z.string().trim().max(500).default(""),
  }).strict(),
  z.object({ action: z.literal("DELIVER") }).strict(),
  z.object({ action: z.literal("CANCEL"), reason: z.string().trim().min(3).max(500) }).strict(),
]);

export const nattaOrderCommandSchema = z.object({
  id: z.uuid(),
  orderId: z.string().min(1).max(150),
  expectedUpdatedAt: z.iso.datetime(),
  requestedAt: z.iso.datetime(),
  actorUserId: z.string().min(1).max(150),
  operation: nattaOrderActionSchema,
}).strict();

export const nattaOrderCommandResultSchema = z.object({
  id: z.uuid(),
  outcome: z.enum(["APPLIED", "REJECTED"]),
  message: z.string(),
  updatedAt: z.iso.datetime().optional(),
});

export type NattaOrderAction = z.infer<typeof nattaOrderActionSchema>;
export type NattaOrderCommand = z.infer<typeof nattaOrderCommandSchema>;
export type NattaOrderCommandResult = z.infer<typeof nattaOrderCommandResultSchema>;

