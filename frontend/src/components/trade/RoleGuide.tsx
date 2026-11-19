import React from "react";

const ROLES = [
  {
    name: "Buyer",
    summary: "Pays into escrow and confirms delivery before funds are released.",
  },
  {
    name: "Seller",
    summary: "Delivers the agreed goods and receives funds once the trade is confirmed.",
  },
  {
    name: "Driver",
    summary: "Moves goods between parties and records the handover manifest.",
  },
  {
    name: "Mediator",
    summary: "Reviews disputes between buyer and seller and issues a binding resolution.",
  },
];

export function RoleGuide() {
  return (
    <section aria-labelledby="role-guide-heading" className="mb-6 rounded-lg border border-border-default p-4">
      <h2 id="role-guide-heading" className="text-base font-semibold mb-3">
        Who does what in this trade
      </h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        {ROLES.map((role) => (
          <div key={role.name}>
            <dt className="text-sm font-medium">{role.name}</dt>
            <dd className="text-sm text-text-secondary">{role.summary}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
