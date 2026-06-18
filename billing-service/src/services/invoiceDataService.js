import {
  getMonthlySummary,
  summaryToInvoiceItems
} from "./billingService.js";

export async function getBillingInvoiceItems(
  tenantUuid,
  year,
  month
) {
  const summary =
    await getMonthlySummary({
      tenantUuid,
      year,
      month
    });

  return summaryToInvoiceItems(summary);
}
