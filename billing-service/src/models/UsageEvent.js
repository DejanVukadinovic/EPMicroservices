import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const EVENT_TYPES = Object.freeze({
  CUSTOMER_CREATED: "CUSTOMER_CREATED",
  CUSTOMER_LIST_VIEWED: "CUSTOMER_LIST_VIEWED",
  CUSTOMER_UPDATED: "CUSTOMER_UPDATED",
  CUSTOMER_DELETED: "CUSTOMER_DELETED",
  INVOICE_CREATED: "INVOICE_CREATED"
});

export const EVENT_PRICES = Object.freeze({
  CUSTOMER_CREATED: 0.5,
  CUSTOMER_LIST_VIEWED: 0.01,
  CUSTOMER_UPDATED: 0,
  CUSTOMER_DELETED: 0,
  INVOICE_CREATED: 1
});

export const UsageEvent = sequelize.define(
  "UsageEvent",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    tenantUuid: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "tenant_uuid"
    },
    eventType: {
      type: DataTypes.ENUM(...Object.values(EVENT_TYPES)),
      allowNull: false,
      field: "event_type"
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    }
  },
  {
    tableName: "usage_events",
    timestamps: true,
    underscored: true
  }
);