import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";
export const ROLES = Object.freeze({

  EPOS_ADMIN: "EPOS_ADMIN",

  TENANT_ADMIN: "TENANT_ADMIN"

});
export const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
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

    role: {

      type: DataTypes.ENUM(...Object.values(ROLES)),

      allowNull: false

    }
  },
  {
    tableName: "users",
    timestamps: true,
    underscored: true
  }
);