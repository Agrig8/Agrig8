import { z } from "zod";
import { TradeStatus } from "@prisma/client";
import { StrKey } from "@stellar/stellar-sdk";
import { createTradeInputSchema } from "./domain/trade";
import {
  MONEY_DECIMALS,
  MoneyConversionError,
  normalizeDecimalString,
  parseDecimalToStroops,
} from "../lib/money";

/**
 * Escrow amount boundaries that mirror the Amana smart contract limits (issue #41).
 *
 * MIN: 1 cNGN (100 stroops at 7 decimals) — prevents zero-value dust trades.
 * MAX: 1,000,000 cNGN (1e13 stroops) — matches the contract's i128 guard rail.
 *
 * Both are expressed in stroops (the atomic unit) so the comparison is integer
 * arithmetic and free of floating-point rounding errors.
 */
export const ESCROW_AMOUNT_MIN_STROOPS = 100n; // 0.000_010_0 cNGN
export const ESCROW_AMOUNT_MAX_STROOPS = 10_000_000_000_000n; // 1,000,000 cNGN

/**
 * Trade creation validation is the CANONICAL shared domain schema
 * (`./domain/trade`, mirrored in `frontend/src/lib/domain-schemas/trade.ts`),
 * plus backend-only checks the framework-free shared schema can't express:
 * a checksum-accurate Stellar key check, and a real stroop-conversion pass on
 * `amountUsdc` (the shared schema only regex-validates the string shape) so an
 * amount that overflows i128 or loses precision is rejected here rather than
 * deep in a contract call.
 */
export const createTradeSchema = createTradeInputSchema
  .superRefine(
    (data: { buyerAddress?: string; sellerAddress?: string; amountUsdc: string }, ctx: z.RefinementCtx) => {
      for (const field of ["buyerAddress", "sellerAddress"] as const) {
        const value = data[field];
        if (value !== undefined && !StrKey.isValidEd25519PublicKey(value)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid Stellar public key for ${field}`,
            path: [field],
          });
        }
      }

      try {
        const stroops = parseDecimalToStroops(data.amountUsdc, MONEY_DECIMALS);
        if (stroops <= 0n) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Amount must be positive", path: ["amountUsdc"] });
        } else if (stroops < ESCROW_AMOUNT_MIN_STROOPS) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Amount is below the minimum escrow limit (0.0000100 cNGN)`,
            path: ["amountUsdc"],
          });
        } else if (stroops > ESCROW_AMOUNT_MAX_STROOPS) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Amount exceeds the maximum escrow limit (1,000,000 cNGN)`,
            path: ["amountUsdc"],
          });
        }
      } catch (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error instanceof MoneyConversionError ? error.message : "Invalid amount",
          path: ["amountUsdc"],
        });
      }
    },
  )
  .transform((data: { amountUsdc: string; [key: string]: unknown }) => ({
    ...data,
    amountUsdc: normalizeDecimalString(data.amountUsdc, MONEY_DECIMALS),
  }));

export const tradeIdParamSchema = z.object({
  id: z.string().min(1, "Trade ID is required"),
});

export const listTradesQuerySchema = z.object({
  status: z.nativeEnum(TradeStatus).optional(),
  page: z.preprocess((val: unknown) => val === undefined ? undefined : Number(val), z.number().int().min(1).default(1)),
  limit: z.preprocess((val: unknown) => val === undefined ? undefined : Number(val), z.number().int().min(1).max(100).default(20)),
  sort: z.string().optional(),
});

export const initiateDisputeSchema = z
  .object({
    reason: z.string().min(10, "Reason must be at least 10 characters"),
    category: z
      .string()
      .trim()
      .min(1, "Category string is required")
      .max(100, "Category must be 100 characters or fewer")
      .optional(),
    categoryId: z.number().int().positive("categoryId must be a positive integer").optional(),
  })
  .superRefine((data: { category?: string; categoryId?: number }, ctx: any) => {
    if (!data.category && data.categoryId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Category string is required",
        path: ["category"],
      });
    }
  });
