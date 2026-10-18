import { z } from "zod";
import { safePlacement } from "../../game/scenes";
import { sceneKeySchema } from "../../game/connected";

export const MAX = {
  photoBytes: 5 * 1024 * 1024,
  audioBytes: 15 * 1024 * 1024,
  audioSeconds: 90,
  photos: 3,
  audio: 1,
};
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const idSchema = z.uuid();
export const invitationSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    expiresAt: z.iso.datetime({ offset: true }).nullable(),
    mapKey: sceneKeySchema.default("sta_ana_house"),
  })
  .strict();
export const contributionSchema = z
  .object({
    // Legacy clients may send these, but identity is always read from the invite.
    displayName: z.string().trim().min(1).max(80).optional(),
    relationship: z.string().trim().max(80).default(""),
    message: z.string().trim().min(1).max(2000),
    consent: z.literal(true),
    uploadIds: z.array(idSchema).max(4),
    shareWithInvitees: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) => new Set(v.uploadIds).size === v.uploadIds.length,
    "Duplicate attachments",
  );
export const uploadSchema = z
  .object({
    kind: z.enum(["photo", "audio"]),
    filename: z.string().min(1).max(200),
    bytes: z.number().int().positive().max(MAX.audioBytes),
    mime: z.string().min(1).max(100),
    description: z.string().trim().max(300).default(""),
  })
  .strict();
export const reviewSchema = z
  .object({
    status: z.enum(["approved", "rejected", "hidden"]),
    message: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();
export const mediaReviewSchema = z
  .object({ status: z.enum(["approved", "rejected"]) })
  .strict();
export const placementSchema = z
  .object({
    contributionId: idSchema,
    areaId: idSchema,
    variant: z.enum(["npc-cream-1", "npc-brown-scarf", "npc-rose-bow"]),
    x: z.number().int().min(0).max(2000),
    y: z.number().int().min(0).max(2000),
    radius: z.number().int().min(0).max(80),
    published: z.boolean(),
  })
  .strict();
export function isSafeHousePlacement(x: number, y: number, radius: number) {
  return safePlacement("sta_ana_house", x, y, radius);
}
export type Contribution = {
  id: string;
  display_name: string;
  relationship_label: string | null;
  share_with_invitees?: boolean;
  message_text: string;
  status: string;
  created_at: string;
  invitation_id: string;
};
export type Media = {
  id: string;
  contribution_id: string;
  kind: "photo" | "audio";
  status: string;
  media_type: string;
  file_size_bytes: number;
  duration_ms: number | null;
  description: string | null;
};
export type Invitation = {
  id: string;
  label: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  assigned_map?: string;
};
export type Area = {
  id: string;
  name: string;
  map_key: string;
  published: boolean;
};
export type Placement = {
  id: string;
  contribution_id: string;
  area_id: string;
  sprite_variant: string;
  spawn_x: number;
  spawn_y: number;
  wander_radius: number;
  published: boolean;
};
export type AdminData = {
  invitations: Invitation[];
  contributions: Contribution[];
  media: Media[];
  areas: Area[];
  placements: Placement[];
};
export type Upload = {
  id: string;
  kind: "photo" | "audio";
  state: string;
  description: string;
};
export type ContributorSnapshot = {
  displayName: string;
  submitted: boolean;
  letter?: {
    message: string;
    version: string;
    shareWithInvitees?: boolean;
    media?: (Upload & { status: string })[];
  } | null;
  uploads: Upload[];
  limits: Pick<typeof MAX, "photoBytes" | "audioBytes" | "audioSeconds">;
};
