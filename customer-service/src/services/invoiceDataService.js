import { withTenantModels } from "./tenantDatabaseService.js";

export async function getCustomerInvoiceItems(
  tenantUuid,
  customerId
) {
  return withTenantModels(
    tenantUuid,
    async ({ Transaction }) => {
      const transactions =
        await Transaction.findAll({
          where: {
            customerId,
            invoiced: false
          }
        });

      return transactions.map(tx => ({
        item: tx.item,
        quantity: Number(tx.quantity),
        price: Number(tx.price)
      }));
    }
  );
}
