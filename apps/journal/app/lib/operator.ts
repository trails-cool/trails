/**
 * Operator details for the Impressum (§5 TMG / §18 MStV).
 *
 * Required by German law. Address must be a reachable physical address.
 * Email must be a direct contact (no forms-only policy).
 */
export const operator = {
  name: "Ullrich Schäfer",
  address: {
    street: "Mehringdamm 87",
    postalCode: "10965",
    city: "Berlin",
    country: "Germany",
  },
  email: "legal@trails.cool",
  // Responsible for content per §18 Abs. 2 MStV
  responsiblePerson: "Ullrich Schäfer",
} as const;

export type Operator = typeof operator;
