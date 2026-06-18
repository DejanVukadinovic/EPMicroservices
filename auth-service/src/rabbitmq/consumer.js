import { getChannel } from "./connection.js";

export async function consume(queue, handler, app) {
  if (!queue) {
    throw new Error("Queue is required");
  }

  const channel = getChannel();

  await channel.assertQueue(queue, { durable: true });

  channel.consume(queue, async (message) => {
    if (!message) return;

    try {
      const payload = JSON.parse(message.content.toString());

      app.log.info({ queue, payload }, "Message received");

      await handler(payload);

      channel.ack(message);
    } catch (error) {
      app.log.error(error, `Failed to process message from queue ${queue}`);
      channel.nack(message, false, false);
    }
  });

  app.log.info(`Consuming queue: ${queue}`);
}