import { withTenantModels } from "../services/tenantDatabaseService.js";
import { publish } from "../rabbitmq/producer.js";
import { authenticatedTenantAdmin } from "../middleware/middleware.js";

const EVENTS = Object.freeze({
  CUSTOMER_CREATED: "CUSTOMER_CREATED",
  CUSTOMER_LIST_VIEWED: "CUSTOMER_LIST_VIEWED",
  CUSTOMER_UPDATED: "CUSTOMER_UPDATED",
  CUSTOMER_DELETED: "CUSTOMER_DELETED"
});

function getTenantUuid(request) {
  return request.params.tenantUuid;
}

async function publishBillingUsage(tenant_uuid, event_type) {
  await publish(process.env.BILLING_USAGE_QUEUE, {
    tenant_uuid,
    event_type
  });
}

export async function customerRoutes(app) {
  app.post(
    "/api/customers/:tenantUuid",
    { preHandler: authenticatedTenantAdmin },
    async (request, reply) => {
      const tenant_uuid = getTenantUuid(request);
      const { name, email, phone, address, pib } = request.body || {};

      if (!name) {
        return reply.code(400).send({
          message: "Customer name is required"
        });
      }

      const customer = await withTenantModels(
        tenant_uuid,
        async ({ Customer }) => {
          return Customer.create({
            name,
            email,
            phone,
            address,
            pib
          });
        }
      );

      await publishBillingUsage(tenant_uuid, EVENTS.CUSTOMER_CREATED);

      return reply.code(201).send(customer);
    }
  );

  app.get(
    "/api/customers/:tenantUuid",
    { preHandler: authenticatedTenantAdmin },
    async (request) => {
      const tenant_uuid = getTenantUuid(request);

      const customers = await withTenantModels(
        tenant_uuid,
        async ({ Customer }) => {
          return Customer.findAll({
            order: [["createdAt", "DESC"]]
          });
        }
      );

      await publishBillingUsage(tenant_uuid, EVENTS.CUSTOMER_LIST_VIEWED);

      return customers;
    }
  );

  app.get(
    "/api/customers/:tenantUuid/:customerId",
    { preHandler: authenticatedTenantAdmin },
    async (request, reply) => {
      const tenant_uuid = getTenantUuid(request);

      const customer = await withTenantModels(
        tenant_uuid,
        async ({ Customer }) => {
          return Customer.findByPk(request.params.customerId);
        }
      );

      if (!customer) {
        return reply.code(404).send({
          message: "Customer not found"
        });
      }

      return customer;
    }
  );

  app.put(
    "/api/customers/:tenantUuid/:customerId",
    { preHandler: authenticatedTenantAdmin },
    async (request, reply) => {
      const tenant_uuid = getTenantUuid(request);
      const { name, email, phone, address, pib } = request.body || {};

      const customer = await withTenantModels(
        tenant_uuid,
        async ({ Customer }) => {
          const existing = await Customer.findByPk(request.params.customerId);

          if (!existing) return null;

          await existing.update({
            name: name ?? existing.name,
            email: email ?? existing.email,
            phone: phone ?? existing.phone,
            address: address ?? existing.address,
            pib: pib ?? existing.pib
          });

          return existing;
        }
      );

      if (!customer) {
        return reply.code(404).send({
          message: "Customer not found"
        });
      }

      await publishBillingUsage(tenant_uuid, EVENTS.CUSTOMER_UPDATED);

      return customer;
    }
  );

  app.delete(
    "/api/customers/:tenantUuid/:customerId",
    { preHandler: authenticatedTenantAdmin },
    async (request, reply) => {
      const tenant_uuid = getTenantUuid(request);

      const deleted = await withTenantModels(
        tenant_uuid,
        async ({ Customer }) => {
          const existing = await Customer.findByPk(request.params.customerId);

          if (!existing) return false;

          await existing.destroy();

          return true;
        }
      );

      if (!deleted) {
        return reply.code(404).send({
          message: "Customer not found"
        });
      }

      await publishBillingUsage(tenant_uuid, EVENTS.CUSTOMER_DELETED);

      return {
        message: "Customer deleted"
      };
    }
  );
}