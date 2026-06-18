import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const INVOICE_STATUS = Object.freeze({
  PROCESSING: "PROCESSING",
  READY: "READY",
  FAILED: "FAILED"
});

export const Invoice = sequelize.define("Invoice", {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  ownerId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: "owner_id"
  },
  status: {
    type: DataTypes.ENUM(...Object.values(INVOICE_STATUS)),
    allowNull: false,
    defaultValue: INVOICE_STATUS.PROCESSING
  },
  fileKey: {
    type: DataTypes.STRING,
    field: "file_key"
  },
  bucket: DataTypes.STRING,
  total: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  errorMessage: {
    type: DataTypes.TEXT,
    field: "error_message"
  }
}, {
  tableName: "invoices",
  timestamps: true,
  underscored: true
}); 