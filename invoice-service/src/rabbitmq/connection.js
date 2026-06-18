import amqp from "amqplib";

let connection;
let channel;
let replyQueue;

export async function connectRabbit(app) {
  connection = await amqp.connect(process.env.RABBITMQ_URL);
  channel = await connection.createChannel();

  const queue = await channel.assertQueue("", {
    exclusive: true,
    autoDelete: true
  });

  replyQueue = queue.queue;

  app.log.info({ replyQueue }, "Invoice RabbitMQ connected");

  return channel;
}

export function getChannel() {
  if (!channel) throw new Error("RabbitMQ channel not initialized");
  return channel;
}

export function getReplyQueue() {
  if (!replyQueue) throw new Error("Reply queue not initialized");
  return replyQueue;
}