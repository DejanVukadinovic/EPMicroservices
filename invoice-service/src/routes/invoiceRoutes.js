import { Invoice, INVOICE_STATUS } from "../models/Invoice.js";
import { publish } from "../rabbitmq/producer.js";
import { getReplyQueue } from "../rabbitmq/connection.js";
import { createDownloadUrl } from "../services/s3Service.js";
import { createSignedDownloadUrl }
  from "../services/downloadService.js";

import { rewriteStorageUrl }
  from "../services/urlService.js";

function requestQueueFor(source) {
  if (source === "CUSTOMER") {
    return process.env.CUSTOMER_INVOICE_DATA_REQUEST_QUEUE;
  }

  if (source === "BILLING") {
    return process.env.BILLING_INVOICE_DATA_REQUEST_QUEUE;
  }

  return null;
}

export async function invoiceRoutes(app) {
  app.post("/api/invoices", async (request, reply) => {
    const { owner_id, source, payload } = request.body || {};

    if (!owner_id || !source || !payload) {
      return reply.code(400).send({
        message: "owner_id, source and payload are required"
      });
    }

    const queue = requestQueueFor(source);

    if (!queue) {
      return reply.code(400).send({
        message: "Invalid invoice source"
      });
    }

    const invoice = await Invoice.create({
      ownerId: owner_id,
      status: INVOICE_STATUS.PROCESSING
    });

    await publish(queue, {
      invoice_id: invoice.id,
      reply_to: getReplyQueue(),
      payload
    });

    return reply.code(202).send({
      invoice_id: invoice.id,
      status: invoice.status,
      websocket_url: `/api/invoices/ws/${invoice.id}`
    });
  });

  app.get("/api/invoices", async (request) => {
    const { owner_id } = request.query;

    return Invoice.findAll({
      where: owner_id ? { ownerId: owner_id } : {},
      order: [["createdAt", "DESC"]]
    });
  });

app.get(
  "/api/invoices/:invoiceId/download",
  async (request, reply) => {

    const invoice =
      await Invoice.findByPk(
        request.params.invoiceId
      );

    if (!invoice) {
      return reply.code(404).send({
        message: "Invoice not found"
      });
    }

    if (invoice.status !== "READY") {
      return reply.code(409).send({
        message: "Invoice still processing"
      });
    }

    const signedUrl =
      await createSignedDownloadUrl(
        invoice.bucket,
        invoice.fileKey
      );

    return {
      downloadUrl:
        rewriteStorageUrl(
          signedUrl
        )
    };
  }
);
}