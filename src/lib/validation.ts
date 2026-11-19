import { z } from "zod";

// Request body contracts for the API. Route handlers parse with these before calling the data layer.
export const titleSchema = z
  .string()
  .trim()
  .min(1, "Title can't be empty.")
  .max(120, "Title must be 120 characters or fewer.");

// Normalize before validating, so pasted or autofilled emails with stray spaces or capitals still match.
const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(200),
});

export const createDocumentSchema = z.object({
  title: titleSchema.optional(),
});

export const updateDocumentSchema = z
  .object({
    baseVersion: z.number().int().min(1, "baseVersion is required."),
    title: titleSchema.optional(),
    content: z.unknown().optional(),
  })
  .refine((body) => body.title !== undefined || body.content !== undefined, {
    message: "Provide a title or content to update.",
  });

export const roleSchema = z.enum(["VIEWER", "EDITOR"], { message: "Role must be VIEWER or EDITOR." });

export const shareSchema = z.object({
  email: emailSchema,
  role: roleSchema,
});

export const updateShareSchema = z.object({ role: roleSchema });
