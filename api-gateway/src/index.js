import Fastify from "fastify";
import proxy from "@fastify/http-proxy";

const app = Fastify({ logger: true });

app.get("/api/health", async () => {
  return { service: "api-gateway", status: "ok" };
});

app.register(proxy, {
  upstream: "http://auth-service:3000",
  prefix: "/api/auth",
  rewritePrefix: "/api/auth"
});

app.register(proxy, {
  upstream: "http://tenant-service:3000",
  prefix: "/api/tenants",
  rewritePrefix: "/api/tenants"
});

app.register(proxy, {
  upstream: "http://customer-service:3000",
  prefix: "/api/customers",
  rewritePrefix: "/api/customers"
});

app.register(proxy, {
  upstream: "http://billing-service:3000",
  prefix: "/api/billing",
  rewritePrefix: "/api/billing"
});

app.register(proxy, {
  upstream: "http://invoice-service:3000",
  prefix: "/api/invoices",
  rewritePrefix: "/api/invoices"
});

await app.listen({ port: 8080, host: "0.0.0.0" });  