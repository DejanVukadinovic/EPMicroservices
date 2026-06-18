import jwt from "jsonwebtoken";
import { ROLES } from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

function getBearerToken(request) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.replace("Bearer ", "");
}

export async function authenticated(request, reply) {
  const token = getBearerToken(request);

  if (!token) {
    return reply.code(401).send({ message: "Missing token" });
  }

  try {
    request.user = jwt.verify(token, JWT_SECRET);
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

export function thisUser(paramName = "id") {
  return async function (request, reply) {
    await authenticated(request, reply);
    if (reply.sent) return;

    if (request.user.role === ROLES.EPOS_ADMIN) return;

    if (request.user.userId !== request.params[paramName]) {
      return reply.code(403).send({ message: "Access denied" });
    }
  };
}