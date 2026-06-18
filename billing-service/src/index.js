import Fastify from "fastify";

import { sequelize } from "./config/database.js";
import { connectRabbit } from "./rabbitmq/connection.js";
import { consume } from "./rabbitmq/consumer.js";
import { recordUsageEvent } from "./services/billingService.js";
import { billingRoutes } from "./routes/billingRoutes.js";
import { getBillingInvoiceItems } from "./services/invoiceDataService.js";
import { publish } from "./rabbitmq/producer.js";

const app = Fastify({ logger: true });

app.get("/api/billing/health", async () => {
  return {
    service: "billing-service",
    status: "ok"
  };
});

await app.register(billingRoutes);

try {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });

  await connectRabbit(app);

await consume(
  process.env.BILLING_USAGE_QUEUE,
  async (payload) => {
    await recordUsageEvent(payload);
  },
  app
);
await consume(
  process.env.BILLING_INVOICE_DATA_REQUEST_QUEUE,
  async (payload) => {

    const items =
      await getBillingInvoiceItems(
        payload.payload.tenant_uuid,
        payload.payload.year,
        payload.payload.month
      );

    await publish(
      payload.reply_to,
      {
        invoice_id: payload.invoice_id,
        items
      },
      { assert: false}
    );
  },
  app
);

  await app.listen({
    port: 3000,
    host: "0.0.0.0"
  });

  app.log.info("Billing service running on port 3000");
} catch (error) {
  app.log.error(error);
  process.exit(1);
}