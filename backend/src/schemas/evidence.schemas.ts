import { z } from "zod";

/**
 * Valid IPFS CID formats (issue #77):
 *   - CIDv0: "Qm" + 44 base58btc chars  (SHA2-256 multihash, 46 chars total)
 *   - CIDv1: "bafy…" (base32, dag-pb/raw) or other multibase prefixes
 *
 * The regex accepts the common pinning-service output shapes.  It does not
 * verify the multihash checksum — that is left to the IPFS gateway.
 */
const CID_REGEX = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,}|B[A-Z2-7]{58,}|z[1-9A-HJ-NP-Za-km-z]{48,}|F[0-9A-Fa-f]{50,})$/;

export const cidSchema = z
  .string()
  .min(1, "CID is required")
  .regex(CID_REGEX, "Invalid IPFS CID format — expected a CIDv0 (Qm…) or CIDv1 (bafy…) string");

export const uploadEvidenceSchema = z.object({
  tradeId: z.string().uuid("Invalid trade ID format"),
});

export const streamEvidenceParamSchema = z.object({
  cid: cidSchema,
});

export const disputeEvidenceQuerySchema = z.object({
  type: z.enum(["video", "manifest"]).optional(),
  page: z.preprocess((value: unknown) => value === undefined ? undefined : Number(value), z.number().int().min(1).default(1)),
  limit: z.preprocess((value: unknown) => value === undefined ? undefined : Number(value), z.number().int().min(1).max(100).default(20)),
});
