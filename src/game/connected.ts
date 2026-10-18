import { z } from "zod";
import { SCENE_KEYS } from "./scenes";
export const sceneKeySchema = z.enum(SCENE_KEYS);
export const npcSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(80),
  variant: z.enum(["npc-cream-1", "npc-brown-scarf", "npc-rose-bow"]),
  x: z.number().int(),
  y: z.number().int(),
  radius: z.number().int().min(0).max(80),
  seen: z.boolean(),
  readable: z.boolean().optional(),
});
export const houseSchema = z.object({ npcs: z.array(npcSchema).max(200) });
export const sceneSchema = houseSchema.extend({ mapKey: sceneKeySchema });
export const contributorVisitSchema = sceneSchema
  .extend({
    visitor: z
      .object({
        name: z.string().min(1).max(80),
        variant: npcSchema.shape.variant,
      })
      .strict(),
  })
  .strict();
export type ContributorVisit = z.infer<typeof contributorVisitSchema>;
export const messageSchema = z.object({
  id: z.uuid(),
  name: z.string().max(80),
  relationship: z.string().max(80),
  message: z.string().min(1).max(2000),
  media: z
    .array(
      z.object({
        id: z.uuid(),
        kind: z.enum(["photo", "audio"]),
        description: z.string().max(300),
      }),
    )
    .max(4),
});
export type WorldNpc = z.infer<typeof npcSchema>;
export type WorldMessage = z.infer<typeof messageSchema>;

export const sharedLetterSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(80),
    message: z.string().min(1).max(2000),
  })
  .strict();
export type SharedLetter = z.infer<typeof sharedLetterSchema>;
