import { DataTypes } from "sequelize";

export function defineCustomerModel(sequelize) {
  return sequelize.define(
    "Customer",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      email: {
        type: DataTypes.STRING
      },
      phone: {
        type: DataTypes.STRING
      },
      address: {
        type: DataTypes.STRING
      },
      pib: {
        type: DataTypes.STRING
      }
    },
    {
      tableName: "customers",
      timestamps: true,
      underscored: true
    }
  );
}