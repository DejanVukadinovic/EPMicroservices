import { UsageEvent } from "../models/UsageEvent.js";
import { admin } from "../middleware/middleware.js";
import {
  getMonthlySummary,
  summaryToInvoiceItems
} from "../services/billingService.js";
import { publish } from "../rabbitmq/producer.js";

export async function billingRoutes(app) {
  app.get("/api/billing/events", { preHandler: admin }, async (request) => {
    const { tenant_uuid } = request.query;

    const where = tenant_uuid ? { tenantUuid: tenant_uuid } : {};

    return UsageEvent.findAll({
      where,
      order: [["createdAt", "DESC"]]
    });
  });

  app.get("/api/billing/summary", { preHandler: admin }, async (request, reply) => {
    const tenantUuid = request.query.tenant_uuid;
    const year = Number(request.query.year);
    const month = Number(request.query.month);

    if (!tenantUuid || !year || !month) {
      return reply.code(400).send({
        message: "tenant_uuid, year and month are required"
      });
    }

    return getMonthlySummary({
      tenantUuid,
      year,
      month
    });
  });

  app.post(
    "/api/billing/monthly-invoice",
    { preHandler: admin },
    async (request, reply) => {
      const { tenant_uuid, year, month } = request.body || {};

      if (!tenant_uuid || !year || !month) {
        return reply.code(400).send({
          message: "tenant_uuid, year and month are required"
        });
      }

      const summary = await getMonthlySummary({
        tenantUuid: tenant_uuid,
        year: Number(year),
        month: Number(month)
      });

      const items = summaryToInvoiceItems(summary);

      if (items.length === 0) {
        return reply.code(409).send({
          message: "No usage events found for selected month"
        });
      }

      await publish(process.env.INVOICE_GENERATE_QUEUE, {
        items
      });

      return reply.code(201).send({
        message: "Billing invoice generation requested",
        items,
        total: summary.total
      });
    }
  );
}