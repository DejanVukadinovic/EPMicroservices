import { DataTypes } from "sequelize";

export function defineTransactionModel(sequelize) {
  return sequelize.define(
    "Transaction",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
      },
      customerId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "customer_id"
      },
      item: {
        type: DataTypes.STRING,
        allowNull: false
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      invoiced: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    },
    {
      tableName: "transactions",
      timestamps: true,
      underscored: true
    }
  );
}