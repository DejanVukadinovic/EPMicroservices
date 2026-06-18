import jwt from "jsonwebtoken";

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

export async function authenticatedTenantAdmin(request, reply) {
  await authenticated(request, reply);
  if (reply.sent) return;

  if (
    request.user.role !== ROLES.EPOS_ADMIN &&
    request.user.role !== ROLES.TENANT_ADMIN
  ) {
    return reply.code(403).send({ message: "Access denied" });
  }
}