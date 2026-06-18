import pg from "pg";
import { Sequelize } from "sequelize";
import { defineCustomerModel } from "../models/Customer.js";
import { defineTransactionModel } from "../models/Transaction.js";

const { Client } = pg;

function getTenantDatabaseName(tenantUuid) {
  return `tenant_${tenantUuid.replaceAll("-", "")}`;
}

async function adminClient() {
  const client = new Client({
    host: process.env.CUSTOMER_DB_HOST,
    port: Number(process.env.CUSTOMER_DB_PORT || 5432),
    user: process.env.CUSTOMER_DB_USER,
    password: process.env.CUSTOMER_DB_PASSWORD,
    database: "postgres"
  });

  await client.connect();
  return client;
}

export function getTenantSequelize(tenantUuid) {
  const dbName = getTenantDatabaseName(tenantUuid);

  return new Sequelize(
    dbName,
    process.env.CUSTOMER_DB_USER,
    process.env.CUSTOMER_DB_PASSWORD,
    {
      host: process.env.CUSTOMER_DB_HOST,
      port: Number(process.env.CUSTOMER_DB_PORT || 5432),
      dialect: "postgres",
      logging: false
    }
  );
}

export function defineTenantModels(sequelize) {
  const Customer = defineCustomerModel(sequelize);
  const Transaction = defineTransactionModel(sequelize);

  return {
    Customer,
    Transaction
  };
}

export async function createTenantDatabase(tenantUuid) {
  const dbName = getTenantDatabaseName(tenantUuid);
  const client = await adminClient();

  try {
    const exists = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (exists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await client.end();
  }

  await migrateTenantDatabase(tenantUuid);

  return dbName;
}

export async function migrateTenantDatabase(tenantUuid) {
  const sequelize = getTenantSequelize(tenantUuid);

  try {
    defineTenantModels(sequelize);
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
  } finally {
    await sequelize.close();
  }
}

export async function withTenantModels(tenantUuid, callback) {
  const sequelize = getTenantSequelize(tenantUuid);
  const models = defineTenantModels(sequelize);

  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });

    return await callback(models, sequelize);
  } finally {
    await sequelize.close();
  }
}