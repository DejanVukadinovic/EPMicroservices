import Fastify from "fastify";
import websocket from "@fastify/websocket";
import crypto from "crypto";

import { sequelize } from "./config/database.js";
import { Invoice, INVOICE_STATUS } from "./models/Invoice.js";

import { connectRabbit } from "./rabbitmq/connection.js";
import { consumeInvoiceDataResponses } from "./rabbitmq/consumer.js";

import {
  generateInvoicePdfBuffer,
  calculateTotal
} from "./services/pdfService.js";

import {
  ensureBucketExists,
  uploadPdf,
  createDownloadUrl
} from "./services/s3Service.js";

import { invoiceRoutes } from "./routes/invoiceRoutes.js";
import { rewriteStorageUrl } from "./services/urlService.js";

const app = Fastify({ logger: true });

const invoiceSockets = new Map();

await app.register(websocket);

app.get("/api/invoices/health", async () => {
  return {
    service: "invoice-service",
    status: "ok"
  };
});

app.get("/api/invoices/ws/:id", { websocket: true }, (socket, request) => {
  const invoiceId = request.params.id;

  invoiceSockets.set(invoiceId, socket);

  socket.on("close", () => {
    invoiceSockets.delete(invoiceId);
  });
});

await app.register(invoiceRoutes);

async function handleInvoiceDataResponse(payload) {
  const invoiceId = payload.invoice_id;
  const items = payload.items;

  if (!invoiceId || !Array.isArray(items)) {
  throw new Error("invoice_id and items are required");
}

  const invoice = await Invoice.findByPk(invoiceId);

  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  try {
    const pdfBuffer = await generateInvoicePdfBuffer(items);
    const fileKey = `invoices/invoice-${crypto.randomUUID()}.pdf`;

    const uploaded = await uploadPdf(fileKey, pdfBuffer);
    const total = calculateTotal(items);

    await invoice.update({
      status: INVOICE_STATUS.READY,
      fileKey: uploaded.key,
      bucket: uploaded.bucket,
      total
    });

    const downloadUrl = await createDownloadUrl(uploaded.key);

    const socket = invoiceSockets.get(invoiceId);

    if (socket) {
      socket.send(JSON.stringify({
        invoice_id: invoiceId,
        status: INVOICE_STATUS.READY,
        download_url: rewriteStorageUrl(downloadUrl)
      }));

      socket.close();
      invoiceSockets.delete(invoiceId);
    }
  } catch (error) {
    await invoice.update({
      status: INVOICE_STATUS.FAILED,
      errorMessage: error.message
    });

    const socket = invoiceSockets.get(invoiceId);

    if (socket) {
      socket.send(JSON.stringify({
        invoice_id: invoiceId,
        status: INVOICE_STATUS.FAILED,
        error: error.message
      }));

      socket.close();
      invoiceSockets.delete(invoiceId);
    }

    throw error;
  }
}

try {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });

  await ensureBucketExists();

  await connectRabbit(app);

  await consumeInvoiceDataResponses(app, handleInvoiceDataResponse);

  await app.listen({
    port: 3000,
    host: "0.0.0.0"
  });

  app.log.info("Invoice service running on port 3000");
} catch (error) {
  app.log.error(error);
  process.exit(1);
}