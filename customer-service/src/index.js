import Fastify from "fastify";

import { connectRabbit } from "./rabbitmq/connection.js";
import { consume } from "./rabbitmq/consumer.js";
import { publish } from "./rabbitmq/producer.js";

import { createTenantDatabase } from "./services/tenantDatabaseService.js";
import { getCustomerInvoiceItems } from "./services/invoiceDataService.js";

import { customerRoutes } from "./routes/customerRoutes.js";
import { transactionRoutes } from "./routes/transactionRoutes.js";

const app = Fastify({ logger: true });

app.get("/api/customers/health", async () => {
  return {
    service: "customer-service",
    status: "ok"
  };
});

await app.register(customerRoutes);
await app.register(transactionRoutes);

try {
  await connectRabbit(app);

  await consume(
    process.env.CUSTOMER_TENANT_CREATED_QUEUE,
    async (payload) => {
      const tenantUuid = payload.tenantId || payload.tenant_uuid;

      if (!tenantUuid) {
        throw new Error("tenantId is required");
      }

      const dbName = await createTenantDatabase(tenantUuid);

      app.log.info(
        { tenantUuid, dbName },
        "Tenant customer database created"
      );
    },
    app
  );

  await consume(
    process.env.CUSTOMER_INVOICE_DATA_REQUEST_QUEUE,
    async (payload) => {
      const items = await getCustomerInvoiceItems(
        payload.payload.tenant_uuid,
        payload.payload.customer_id
      );

      await publish(payload.reply_to, {
        invoice_id: payload.invoice_id,
        items
      },{
        assert: false
      });
    },
    app
  );

  await app.listen({
    port: 3000,
    host: "0.0.0.0"
  });

  app.log.info("Customer service running on port 3000");
} catch (error) {
  app.log.error(error);
  process.exit(1);
}