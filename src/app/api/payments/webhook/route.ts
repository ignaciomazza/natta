import { after } from "next/server";
import { createWebhookHandler } from "@/lib/payments/webhook-handler";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = createWebhookHandler(after);
