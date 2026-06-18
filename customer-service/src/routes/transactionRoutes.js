import { withTenantModels } from "../services/tenantDatabaseService.js";
import { publish } from "../rabbitmq/producer.js";
import { authenticatedTenantAdmin } from "../middleware/middleware.js";

const EVENTS = Object.freeze({
  INVOICE_CREATED: "INVOICE_CREATED"
});

export async function transactionRoutes(app) {
  app.post(
    "/api/customers/transactions/:tenantUuid/:customerId",
    { preHandler: authenticatedTenantAdmin },
    async (request, reply) => {
      const { tenantUuid, customerId } = request.params;
      const { item, quantity, price } = request.body || {};

      if (!item || !quantity || !price) {
        return reply.code(400).send({
          message: "item, quantity and price are required"
        });
      }

      const transaction = await withTenantModels(
        tenantUuid,
        async ({ Customer, Transaction }) => {
          const customer = await Customer.findByPk(customerId);

          if (!customer) return null;

          return Transaction.create({
            customerId,
            item,
            quantity,
            price,
            invoiced: false
          });
        }
      );

      if (!transaction) {
        return reply.code(404).send({ message: "Customer not found" });
      }

      return reply.code(201).send(transaction);
    }
  );

  app.get(
    "/api/customers/transactions/:tenantUuid/:customerId",
    { preHandler: authenticatedTenantAdmin },
    async (request) => {
      const { tenantUuid, customerId } = request.params;

      return withTenantModels(tenantUuid, async ({ Transaction }) => {
        return Transaction.findAll({
          where: { customerId },
          order: [["createdAt", "DESC"]]
        });
      });
    }
  );

  app.delete(
    "/api/customers/transactions/:tenantUuid/:transactionId",
    { preHandler: authenticatedTenantAdmin },
    async (request, reply) => {
      const { tenantUuid, transactionId } = request.params;

      const result = await withTenantModels(
        tenantUuid,
        async ({ Transaction }) => {
          const transaction = await Transaction.findByPk(transactionId);

          if (!transaction) return { status: "NOT_FOUND" };
          if (transaction.invoiced) return { status: "ALREADY_INVOICED" };

          await transaction.destroy();

          return { status: "DELETED" };
        }
      );

      if (result.status === "NOT_FOUND") {
        return reply.code(404).send({ message: "Transaction not found" });
      }

      if (result.status === "ALREADY_INVOICED") {
        return reply.code(409).send({
          message: "Invoiced transactions cannot be deleted"
        });
      }

      return { message: "Transaction deleted" };
    }
  );

  app.post(
    "/api/customers/transactions/:tenantUuid/:customerId/invoice",
    { preHandler: authenticatedTenantAdmin },
    async (request, reply) => {
      const { tenantUuid, customerId } = request.params;

      const result = await withTenantModels(
        tenantUuid,
        async ({ Customer, Transaction }, sequelize) => {
          return sequelize.transaction(async (dbTx) => {
            const customer = await Customer.findByPk(customerId, {
              transaction: dbTx
            });

            if (!customer) {
              return { status: "CUSTOMER_NOT_FOUND" };
            }

            const transactions = await Transaction.findAll({
              where: {
                customerId,
                invoiced: false
              },
              transaction: dbTx
            });

            if (transactions.length === 0) {
              return { status: "NO_TRANSACTIONS" };
            }

            await Transaction.update(
              { invoiced: true },
              {
                where: {
                  id: transactions.map((tx) => tx.id)
                },
                transaction: dbTx
              }
            );

            return {
              status: "OK",
              items: transactions.map((tx) => ({
                item: tx.item,
                quantity: Number(tx.quantity),
                price: Number(tx.price)
              }))
            };
          });
        }
      );

      if (result.status === "CUSTOMER_NOT_FOUND") {
        return reply.code(404).send({ message: "Customer not found" });
      }

      if (result.status === "NO_TRANSACTIONS") {
        return reply.code(409).send({
          message: "No uninvoiced transactions found"
        });
      }

      await publish(process.env.INVOICE_GENERATE_QUEUE, {
        items: result.items
      });

      await publish(process.env.BILLING_USAGE_QUEUE, {
        tenant_uuid: tenantUuid,
        event_type: EVENTS.INVOICE_CREATED
      });

      return reply.code(201).send({
        message: "Invoice generation requested",
        items: result.items
      });
    }
  );
}