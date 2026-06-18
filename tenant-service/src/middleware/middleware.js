import jwt from "jsonwebtoken";
import { Tenant } from "../models/Tenant.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export const ROLES = Object.freeze({
  EPOS_ADMIN: "EPOS_ADMIN",
  TENANT_ADMIN: "TENANT_ADMIN"
});

export async function authenticated(request, reply) {
  const header = request.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return reply.code(401).send({ message: "Missing token" });
  }

  try {
    request.user = jwt.verify(header.replace("Bearer ", ""), JWT_SECRET);
  } catch {
    return reply.code(401).send({ message: "Invalid token" });
  }
}

export async function admin(request, reply) {
  await authenticated(request, reply);
  if (reply.sent) return;

  if (request.user.role !== ROLES.EPOS_ADMIN) {
    return reply.code(403).send({ message: "Admin access required" });
  }
}

export async function adminOrTenantOwner(request, reply) {
  await authenticated(request, reply);
  if (reply.sent) return;

  if (request.user.role === ROLES.EPOS_ADMIN) return;

  const tenant = await Tenant.findByPk(request.params.id);

  if (!tenant) {
    return reply.code(404).send({ message: "Tenant not found" });
  }

  if (tenant.adminUserId !== request.user.userId) {
    return reply.code(403).send({ message: "Access denied" });
  }

  request.tenant = tenant;
}