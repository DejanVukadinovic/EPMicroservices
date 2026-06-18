import { getChannel } from "./connection.js";

export async function publish(queue, payload) {
  if (!queue) throw new Error("Queue is required");

  const channel = getChannel();

  await channel.assertQueue(queue, { durable: true });

  channel.sendToQueue(
    queue,
    Buffer.from(JSON.stringify(payload)),
    { persistent: true }
  );
}