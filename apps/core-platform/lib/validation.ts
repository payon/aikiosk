import { z } from "zod";

export const AppCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  targetUrl: z.string().url().startsWith("https://"),
  iconUrl: z.string().min(1).max(500),
  description: z.string().max(500).optional(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true)
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
