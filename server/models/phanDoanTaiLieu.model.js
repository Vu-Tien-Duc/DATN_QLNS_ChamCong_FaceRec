// Mô hình bảng phan_doan_tai_lieu: các đoạn văn bản và vector nhúng phục vụ tìm kiếm RAG.
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');
const { uuidPk, uuidFk, jsonText } = require('./modelHelpers');

class PhanDoanTaiLieu extends Model {}

PhanDoanTaiLieu.init(
  {
    id: uuidPk(),
    tai_lieu_id: uuidFk(false),
    thu_tu: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
    noi_dung_chunk: { type: DataTypes.TEXT, allowNull: false },
    vector_embedding: jsonText('vector_embedding', null),
    so_tu: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
  },
  {
    sequelize,
    modelName: 'PhanDoanTaiLieu',
    tableName: 'phan_doan_tai_lieu',
    timestamps: true,
    createdAt: 'tao_luc',
    updatedAt: false,
    hooks: {
      beforeValidate: (chunk) => {
        if (chunk.noi_dung_chunk && !chunk.so_tu) {
          chunk.so_tu = String(chunk.noi_dung_chunk).trim().split(/\s+/).filter(Boolean).length;
        }
      },
    },
    indexes: [
      { unique: true, fields: ['tai_lieu_id', 'thu_tu'] },
      { fields: ['tai_lieu_id'] },
    ],
  }
);

module.exports = PhanDoanTaiLieu;
