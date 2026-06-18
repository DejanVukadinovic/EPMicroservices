import { User, ROLES } from "../models/User.js";

export async function createTenantAdminFromApprovedTenant(payload) {
  const email = payload.adminEmail || payload.email;
  const userId = payload.adminUserId;
  const passwordHash = payload.passwordHash;

  if (!email) {
    throw new Error("Tenant approved event missing admin email");
  }

  if (!userId) {
    throw new Error("Tenant approved event missing adminUserId");
  }

  if (!passwordHash) {
    throw new Error("Tenant approved event missing passwordHash");
  }

  const existing = await User.findByPk(userId);

  if (existing) {
    return existing;
  }

  return User.create({
    id: userId,
    email,
    passwordHash,
    role: ROLES.TENANT_ADMIN
  });
}