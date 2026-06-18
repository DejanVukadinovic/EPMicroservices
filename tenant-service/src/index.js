import Fastify from "fastify";
import crypto from "crypto";
import { sequelize } from "./config/database.js";
import { Tenant } from "./models/Tenant.js";
import { admin, adminOrTenantOwner } from "./middleware/middleware.js";
import { publish } from "./rabbitmq/producer.js";
import { connectRabbit } from "./rabbitmq/connection.js";
import bcrypt from "bcryptjs";
import { authenticated } from "./middleware/middleware.js";

const app = Fastify({ logger: true });

app.get("/api/tenants/health", async () => {
  return { service: "tenant-service", status: "ok" };
});

app.post("/api/tenants/register", async (request, reply) => {
  const { companyName, email, password } = request.body || {};

  if (!companyName || !email || !password) {
    return reply.code(400).send({
      message: "companyName, email and password are required"
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await Tenant.create({
      adminUserId: crypto.randomUUID(),
      companyName,
      email,
      passwordHash,
      approved: false
    });

    return reply.code(201).send({
      id: tenant.id,
      adminUserId: tenant.adminUserId,
      companyName: tenant.companyName,
      email: tenant.email,
      approved: tenant.approved,
      createdAt: tenant.createdAt
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return reply.code(409).send({ message: "Tenant email already exists" });
    }

    request.log.error(error);
    return reply.code(500).send({ message: "Tenant registration failed" });
  }
});

app.get("/api/tenants", { preHandler: admin }, async () => {
  return Tenant.findAll({
    order: [["createdAt", "DESC"]]
  });
});

app.get("/api/tenants/:id", { preHandler: adminOrTenantOwner }, async (request, reply) => {
  const tenant = request.tenant || await Tenant.findByPk(request.params.id);

  if (!tenant) {
    return reply.code(404).send({ message: "Tenant not found" });
  }

  return tenant;
});

app.put("/api/tenants/:id", { preHandler: adminOrTenantOwner }, async (request, reply) => {
  const tenant = request.tenant || await Tenant.findByPk(request.params.id);

  if (!tenant) {
    return reply.code(404).send({ message: "Tenant not found" });
  }

  const {
    companyName,
    email,
    phone,
    address,
    pib
  } = request.body || {};

  try {
    await tenant.update({
      companyName: companyName ?? tenant.companyName,
      email: email ?? tenant.email,
      phone: phone ?? tenant.phone,
      address: address ?? tenant.address,
      pib: pib ?? tenant.pib
    });

    return tenant;
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return reply.code(409).send({ message: "Tenant email already exists" });
    }

    request.log.error(error);
    return reply.code(500).send({ message: "Tenant update failed" });
  }
});

app.delete("/api/tenants/:id", { preHandler: adminOrTenantOwner }, async (request, reply) => {
  const tenant = request.tenant || await Tenant.findByPk(request.params.id);

  if (!tenant) {
    return reply.code(404).send({ message: "Tenant not found" });
  }

  await tenant.destroy();

  return { message: "Tenant deleted" };
});
app.get("/api/tenants/me", { preHandler: authenticated }, async (request, reply) => {
  const tenant = await Tenant.findOne({
    where: {
      adminUserId: request.user.userId
    }
  });

  if (!tenant) {
    return reply.code(404).send({ message: "Tenant not found" });
  }

  return tenant;
});

app.patch("/api/tenants/:id/approve", { preHandler: admin }, async (request, reply) => {
  const tenant = await Tenant.findByPk(request.params.id);

  if (!tenant) {
    return reply.code(404).send({ message: "Tenant not found" });
  }

  if (tenant.approved) {
    return reply.code(409).send({ message: "Tenant already approved" });
  }

  await tenant.update({ approved: true });

await publish(process.env.AUTH_TENANT_APPROVED_QUEUE, {
  tenantId: tenant.id,
  adminUserId: tenant.adminUserId,
  adminEmail: tenant.email,
  passwordHash: tenant.passwordHash,
  companyName: tenant.companyName
});
await publish(
  process.env.CUSTOMER_TENANT_CREATED_QUEUE,
  {
    tenantId: tenant.id
  }
);

  return tenant;
});

try {

  await sequelize.authenticate();

  await sequelize.sync({ alter: true });

  await connectRabbit(app);

  await app.listen({

    port: 3000,

    host: "0.0.0.0"

  });

  app.log.info("Tenant service running on port 3000");

} catch (error) {

  app.log.error(error);

  process.exit(1);

}