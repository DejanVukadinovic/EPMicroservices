import { getChannel } from "./connection.js";

export async function consume(queue, handler, app) {
  const channel = getChannel();

  app.log.info(`Registering consumer for queue: ${queue}`);

  await channel.assertQueue(queue, { durable: true });

  channel.consume(queue, async (message) => {
    if (!message) return;

    try {
      const payload = JSON.parse(message.content.toString());

      app.log.info(
        { queue, payload },
        "Message received"
      );

      await handler(payload);

      channel.ack(message);
    } catch (error) {
      app.log.error(error);

      channel.nack(message, false, false);
    }
  });

  app.log.info(`Consumer active on queue: ${queue}`);
}