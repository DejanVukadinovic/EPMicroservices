import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Tenant = sequelize.define(
  "Tenant",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },

    adminUserId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "admin_user_id"
    },

    companyName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "company_name"
    },

    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },

    passwordHash: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "password_hash"
    },

    approved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  },
  {
    tableName: "tenants",
    timestamps: true,
    underscored: true
  }
);