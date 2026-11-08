import { z } from "zod";

const PushEndpointSchema = z
  .url()
  .max(2048)
  .refine((value) => value.startsWith("https://"), "Endpoint must use HTTPS");

export const CreatePushSubscriptionSchema = z.object({
  endpoint: PushEndpointSchema,
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
});

export const PushSubscriptionQuerySchema = z.object({
  endpoint: PushEndpointSchema,
});

export const SetRestTimerSchema = z.object({
  endAt: z.iso.datetime(),
});

export const VapidPublicKeySchema = z.object({
  publicKey: z.string().min(1),
});

export type CreatePushSubscriptionInput = z.infer<
  typeof CreatePushSubscriptionSchema
>;
export type PushSubscriptionQuery = z.infer<
  typeof PushSubscriptionQuerySchema
>;
export type SetRestTimerInput = z.infer<typeof SetRestTimerSchema>;
export type VapidPublicKey = z.infer<typeof VapidPublicKeySchema>;
