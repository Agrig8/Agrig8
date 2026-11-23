import { redactPii } from "../lib/logRedaction";

describe("redactPii", () => {
  it("redacts denylisted field names regardless of value shape", () => {
    const input = {
      email: "trader@example.com",
      phoneNumber: "+15551234567",
      driverIdNumber: "A1234567",
      password: "hunter2",
      note: "call me on my mobile",
    };

    const result = redactPii(input);

    expect(result.email).toBe("[REDACTED]");
    expect(result.phoneNumber).toBe("[REDACTED]");
    expect(result.driverIdNumber).toBe("[REDACTED]");
    expect(result.password).toBe("[REDACTED]");
    expect(result.note).toBe("call me on my mobile");
  });

  it("scrubs email/phone-shaped substrings embedded in free text", () => {
    const input = {
      message: "Dispute filed by trader (contact: jane.doe@example.com, +2348012345678) re trade #42",
    };

    const result = redactPii(input);

    expect(result.message).not.toMatch(/jane\.doe@example\.com/);
    expect(result.message).not.toMatch(/\+2348012345678/);
    expect(result.message).toContain("[REDACTED_EMAIL]");
    expect(result.message).toContain("[REDACTED_PHONE]");
    expect(result.message).toContain("trade #42");
  });

  it("recurses through nested objects and arrays", () => {
    const input = {
      trade: {
        id: "T-1",
        parties: [
          { role: "buyer", email: "buyer@example.com" },
          { role: "seller", email: "seller@example.com" },
        ],
      },
    };

    const result = redactPii(input) as typeof input;

    expect(result.trade.parties[0].email).toBe("[REDACTED]");
    expect(result.trade.parties[1].email).toBe("[REDACTED]");
    expect(result.trade.id).toBe("T-1");
  });

  it("does not redact ids, amounts, or Stellar addresses that merely contain digits", () => {
    const input = {
      tradeId: "550e8400-e29b-41d4-a716-446655440000",
      amount: 125000,
      ledgerSequence: 48213093,
      stellarAddress: "GABCDEFGH1234567890IJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOP",
    };

    const result = redactPii(input);

    expect(result).toEqual(input);
  });

  it("leaves null/undefined field values as-is instead of stamping REDACTED", () => {
    const input = { email: null, phone: undefined };
    const result = redactPii(input);
    expect(result.email).toBeNull();
    expect(result.phone).toBeUndefined();
  });

  it("redacts error messages but preserves stack/name for debuggability", () => {
    const err = new Error("failed webhook delivery to owner alice@example.com");
    const result = redactPii({ err }).err as Error;

    expect(result.message).toContain("[REDACTED_EMAIL]");
    expect(result.message).not.toContain("alice@example.com");
    expect(result.name).toBe("Error");
  });

  it("does not mutate the input object", () => {
    const input = { email: "test@example.com" };
    redactPii(input);
    expect(input.email).toBe("test@example.com");
  });

  it("handles circular references without throwing", () => {
    const input: Record<string, unknown> = { email: "test@example.com" };
    input.self = input;

    expect(() => redactPii(input)).not.toThrow();
    const result = redactPii(input) as Record<string, unknown>;
    expect(result.self).toBe("[CIRCULAR]");
  });

  it("passes representative full request-cycle payloads with PII fully absent", () => {
    // Representative of a real trade-dispute payload flowing through the app.
    const payload = {
      event: "dispute.filed",
      trade: {
        id: "T-9001",
        buyerAddress: "GBUYERADDRXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        buyerContact: { email: "buyer@example.com", phone: "+14155552671" },
        sellerContact: { email: "seller@example.com", phone: "+442071838750" },
      },
      manifest: {
        driverName: "John Doe",
        driverIdNumber: "DL-99881",
        deliveryNotes: "Left with neighbour, they can be reached at 555-987-6543",
      },
    };

    const serialized = JSON.stringify(redactPii(payload));

    expect(serialized).not.toContain("buyer@example.com");
    expect(serialized).not.toContain("seller@example.com");
    expect(serialized).not.toContain("+14155552671");
    expect(serialized).not.toContain("+442071838750");
    expect(serialized).not.toContain("555-987-6543");
    expect(serialized).not.toContain("John Doe");
    expect(serialized).not.toContain("DL-99881");
    expect(serialized).toContain("T-9001");
  });
});

describe("redactPii — extended denylist (issue #43)", () => {
  it("redacts standalone address field", () => {
    const input = { address: "123 Main St, Lagos" };
    const result = redactPii(input);
    expect(result.address).toBe("[REDACTED]");
  });

  it("redacts postal address variants", () => {
    const fields = {
      mailingAddress: "456 Elm Rd",
      billingAddress: "789 Oak Ave",
      shippingAddress: "1 Trade Blvd",
      city: "Abuja",
      state: "FCT",
      country: "Nigeria",
      zipCode: "90001",
      postalCode: "12345",
      postCode: "SW1A",
    };
    const result = redactPii(fields);
    for (const key of Object.keys(fields)) {
      expect((result as Record<string, unknown>)[key]).toBe("[REDACTED]");
    }
  });

  it("redacts financial fields", () => {
    const fields = {
      bankAccount: "0012345678",
      accountNumber: "9876543210",
      routingNumber: "021000021",
      iban: "GB29NWBK60161331926819",
      bic: "NWBKGB2L",
      swiftCode: "CITIUS33",
    };
    const result = redactPii(fields);
    for (const key of Object.keys(fields)) {
      expect((result as Record<string, unknown>)[key]).toBe("[REDACTED]");
    }
  });

  it("redacts auth token fields", () => {
    const fields = {
      bearerToken: "eyJhbGciOiJIUzI1NiJ9.test",
      xApiKey: "sk-live-secret-key",
      csrfToken: "csrf_abc123",
    };
    const result = redactPii(fields);
    for (const key of Object.keys(fields)) {
      expect((result as Record<string, unknown>)[key]).toBe("[REDACTED]");
    }
  });

  it("redacts name and username", () => {
    const fields = {
      name: "Emeka Obi",
      username: "emeka_obi",
    };
    const result = redactPii(fields);
    expect(result.name).toBe("[REDACTED]");
    expect(result.username).toBe("[REDACTED]");
  });

  it("preserves non-PII fields alongside redacted ones", () => {
    const input = {
      tradeId: "T-9999",
      address: "1 Secret Lane",
      amount: 50000,
      city: "Lagos",
      status: "ACTIVE",
    };
    const result = redactPii(input);
    expect(result.tradeId).toBe("T-9999");
    expect(result.amount).toBe(50000);
    expect(result.status).toBe("ACTIVE");
    expect(result.address).toBe("[REDACTED]");
    expect(result.city).toBe("[REDACTED]");
  });
});
