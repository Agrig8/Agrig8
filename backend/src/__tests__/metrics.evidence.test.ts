/**
 * Evidence upload metrics (#173).
 *
 * Verifies outcome/size-band labelling through the injectable recorder so no
 * live OTel pipeline is needed.
 */
import { PrismaClient } from "@prisma/client";
import {
    __resetEvidenceMetricsForTests,
    __setEvidenceRecorderForTests,
    classifyEvidenceSizeBand,
    EvidenceUploadMetricsRecorder,
    EvidenceUploadOutcome,
    EvidenceSizeBand,
} from "../lib/metrics";
import {
    EvidenceService,
    classifyEvidenceUploadError,
    EvidenceValidationError,
    EvidenceScanError,
    EvidenceDuplicateError,
    EvidenceAccessDeniedError,
    EvidenceTradeNotFoundError,
} from "../services/evidence.service";

const MB = 1024 * 1024;
const BUYER = "GCBUYER0000000000000000000000000000000000000000000000000";
const MP4_HEADER = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);

function makeRecorder() {
    const outcomes: Array<[EvidenceUploadOutcome, EvidenceSizeBand]> = [];
    let retries = 0;
    const recorder: EvidenceUploadMetricsRecorder = {
        recordEvidenceUpload: (o, b) => outcomes.push([o, b]),
        recordEvidenceUploadRetry: () => {
            retries++;
        },
    };
    return { recorder, outcomes, retries: () => retries };
}

describe("classifyEvidenceSizeBand", () => {
    it("buckets sizes at the documented boundaries", () => {
        expect(classifyEvidenceSizeBand(0)).toBe("lt_1mb");
        expect(classifyEvidenceSizeBand(MB - 1)).toBe("lt_1mb");
        expect(classifyEvidenceSizeBand(MB)).toBe("1mb_to_10mb");
        expect(classifyEvidenceSizeBand(10 * MB)).toBe("10mb_to_50mb");
        expect(classifyEvidenceSizeBand(50 * MB)).toBe("10mb_to_50mb");
        expect(classifyEvidenceSizeBand(50 * MB + 1)).toBe("gt_50mb");
    });

    it("returns unknown for non-finite or negative sizes", () => {
        expect(classifyEvidenceSizeBand(NaN)).toBe("unknown");
        expect(classifyEvidenceSizeBand(-1)).toBe("unknown");
    });
});

describe("classifyEvidenceUploadError", () => {
    it("maps each evidence error class to a bounded outcome label", () => {
        expect(classifyEvidenceUploadError(new EvidenceValidationError("x"))).toBe("validation_failed");
        expect(classifyEvidenceUploadError(new EvidenceScanError())).toBe("scan_blocked");
        expect(classifyEvidenceUploadError(new EvidenceDuplicateError("cid"))).toBe("duplicate");
        expect(classifyEvidenceUploadError(new EvidenceAccessDeniedError())).toBe("access_denied");
        expect(classifyEvidenceUploadError(new EvidenceTradeNotFoundError())).toBe("not_found");
        expect(classifyEvidenceUploadError(new Error("ipfs down"))).toBe("failed");
    });
});

describe("EvidenceService upload metrics", () => {
    let recorded: ReturnType<typeof makeRecorder>;

    beforeEach(() => {
        recorded = makeRecorder();
        __setEvidenceRecorderForTests(recorded.recorder);
    });

    afterEach(() => {
        __resetEvidenceMetricsForTests();
    });

    const file = (size = MP4_HEADER.length) =>
        ({
            buffer: MP4_HEADER,
            size,
            mimetype: "video/mp4",
            originalname: "video.mp4",
        }) as any;

    function buildService(createImpl: jest.Mock) {
        const prisma = {
            trade: {
                findUnique: jest.fn().mockResolvedValue({
                    tradeId: "t1",
                    buyerAddress: BUYER,
                    sellerAddress: "GCSELLER",
                }),
            },
            tradeEvidence: { create: createImpl, findMany: jest.fn() },
        } as unknown as PrismaClient;
        return new EvidenceService(
            prisma as any,
            { uploadFile: jest.fn().mockResolvedValue("bafycid"), getFileUrl: (c: string) => c } as any,
            { scan: jest.fn().mockResolvedValue({ clean: true }) } as any,
        );
    }

    it("records a success with the size band of the uploaded file", async () => {
        const service = buildService(jest.fn().mockResolvedValue({ id: 1 }));
        await service.uploadVideoEvidence("t1", BUYER, file(2 * MB));
        expect(recorded.outcomes).toEqual([["success", "1mb_to_10mb"]]);
        expect(recorded.retries()).toBe(0);
    });

    it("records a duplicate as both an outcome and a retry", async () => {
        const dup = Object.assign(new Error("unique"), { code: "P2002" });
        const service = buildService(jest.fn().mockRejectedValue(dup));
        await expect(service.uploadVideoEvidence("t1", BUYER, file())).rejects.toBeInstanceOf(
            EvidenceDuplicateError,
        );
        expect(recorded.outcomes).toEqual([["duplicate", "lt_1mb"]]);
        expect(recorded.retries()).toBe(1);
    });

    it("records a validation failure and still rethrows it", async () => {
        const service = buildService(jest.fn());
        const bad = { ...file(), mimetype: "video/avi" } as any;
        await expect(service.uploadVideoEvidence("t1", BUYER, bad)).rejects.toBeInstanceOf(
            EvidenceValidationError,
        );
        expect(recorded.outcomes).toEqual([["validation_failed", "lt_1mb"]]);
    });
});
