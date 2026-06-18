import amqp from "amqplib";

let channel;

export async function connectRabbit(app) {
  if (channel) return channel;

  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  channel = await connection.createChannel();

  app.log.info("Billing RabbitMQ connected");

  return channel;
}

export function getChannel() {
  if (!channel) {
    throw new Error("RabbitMQ channel not initialized");
  }

  return channel;
}