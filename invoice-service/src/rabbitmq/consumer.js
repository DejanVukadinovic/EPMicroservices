import { getChannel, getReplyQueue } from "./connection.js";

export async function consumeInvoiceDataResponses(app, handler) {
  const channel = getChannel();
  const queue = getReplyQueue();

  channel.consume(queue, async (message) => {
    if (!message) return;

    try {
      const payload = JSON.parse(message.content.toString());
      await handler(payload);
      channel.ack(message);
    } catch (error) {
      app.log.error(error, "Failed to process invoice data response");
      channel.nack(message, false, false);
    }
  });

  app.log.info(`Invoice service consuming reply queue: ${queue}`);
}