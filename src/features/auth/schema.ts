import { z } from "zod";

export const devLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
});

export type DevLoginInput = z.infer<typeof devLoginSchema>;
