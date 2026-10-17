import { z } from "zod";

export const finaleDraftSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    letter: z.string().trim().max(12000),
    threshold: z.number().int().min(0).max(50),
    conversation: z
      .array(
        z
          .object({
            speaker: z.enum(["Dudu", "Bubu"]),
            text: z.string().trim().min(1).max(2000),
          })
          .strict(),
      )
      .max(30),
  })
  .strict();
export const finaleContentSchema = finaleDraftSchema.refine(
  (v) => v.letter.length > 0 && v.conversation.length > 0,
  "Add a letter and at least one conversation line before publishing.",
);
export const finaleSchema = z
  .object({ revision: z.number().int().min(1), content: finaleContentSchema })
  .strict();
export const finaleAdminSchema = z
  .object({
    revision: z.number().int().min(0),
    draft: finaleDraftSchema,
    published: z.boolean(),
  })
  .strict();
export const finaleStatusSchema = z
  .object({
    available: z.boolean(),
    unlocked: z.boolean(),
    seen: z.number().int().min(0),
    required: z.number().int().min(0),
    completed: z.boolean(),
  })
  .strict();
export type FinaleContent = z.infer<typeof finaleDraftSchema>;
export type Finale = z.infer<typeof finaleSchema>;
export type FinaleStatus = z.infer<typeof finaleStatusSchema>;
export const SAMPLE_FINALE: Finale = {
  revision: 1,
  content: {
    title: "A little sample letter",
    letter:
      "Dear Bubu,\n\nThis is a synthetic letter for trying the ending. Dudu will write the personal letter privately before publishing.\n\nFor now, take a little breath and meet your sample companion. ♡",
    threshold: 0,
    conversation: [
      {
        speaker: "Dudu",
        text: "This is a practice reunion. You can return to the world whenever you like.",
      },
      { speaker: "Bubu", text: "Let’s stay a little longer. ♡" },
      {
        speaker: "Dudu",
        text: "Every hello will still be here when you come back.",
      },
    ],
  },
};
