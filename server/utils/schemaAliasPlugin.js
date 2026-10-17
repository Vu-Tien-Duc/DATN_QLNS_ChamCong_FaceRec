const mongoose = require('mongoose');

/**
 * Hàm đệ quy chuyển đổi các trường alias tiếng Anh sang tên trường tiếng Việt trong MongoDB
 * @param {Object} obj Đối tượng query, projection, sort hoặc update
 * @param {Object} aliases Bảng ánh xạ alias từ Mongoose Schema
 * @returns {Object} Đối tượng đã được ánh xạ chuẩn tiếng Việt
 */
function mapAliases(obj, aliases) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  if (obj instanceof Date || obj instanceof mongoose.Types.ObjectId || obj instanceof RegExp) {
    return obj;
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const prefix = key.startsWith('+') ? '+' : key.startsWith('-') ? '-' : '';
    const bareKey = prefix ? key.slice(1) : key;
    const realKey = prefix + (aliases[bareKey] || bareKey);

    if (Array.isArray(value)) {
      result[realKey] = value.map((item) =>
        item && typeof item === 'object' && !(item instanceof Date) && !(item instanceof mongoose.Types.ObjectId) && !(item instanceof RegExp)
          ? mapAliases(item, aliases)
          : item
      );
    } else if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof mongoose.Types.ObjectId) && !(value instanceof RegExp)) {
      result[realKey] = mapAliases(value, aliases);
    } else {
      result[realKey] = value;
    }
  }
  return result;
}

/**
 * Hàm ánh xạ các đường dẫn populate từ alias tiếng Anh sang trường thực tế tiếng Việt
 */
function mapPopulate(populates, aliases) {
  if (!populates || typeof populates !== 'object') return populates;

  if (Array.isArray(populates)) {
    return populates.map((p) => {
      if (typeof p === 'string') return aliases[p] || p;
      if (p && typeof p === 'object') {
        const real = { ...p, path: aliases[p.path] || p.path };
        if (real.populate) real.populate = mapPopulate(real.populate, aliases);
        return real;
      }
      return p;
    });
  }

  const newPopulates = {};
  for (const [key, pop] of Object.entries(populates)) {
    const realKey = aliases[key] || key;
    if (pop && typeof pop === 'object') {
      pop.path = aliases[pop.path] || pop.path;
      if (pop.populate) {
        pop.populate = mapPopulate(pop.populate, aliases);
      }
    }
    newPopulates[realKey] = pop;
  }
  return newPopulates;
}

/**
 * Plugin Mongoose tự động hỗ trợ query, update, sort và populate bằng cả tên alias tiếng Anh lẫn tên tiếng Việt
 */
function schemaAliasPlugin(schema) {
  const queryOps = [
    'find',
    'findOne',
    'countDocuments',
    'estimatedDocumentCount',
    'findOneAndUpdate',
    'findOneAndDelete',
    'findOneAndReplace',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
  ];

  schema.pre(queryOps, function () {
    const aliases = this.schema?.aliases;
    if (!aliases || Object.keys(aliases).length === 0) return;

    // 1. Ánh xạ filter query
    const filter = this.getQuery();
    if (filter && typeof filter === 'object') {
      this.setQuery(mapAliases(filter, aliases));
    }

    // 2. Ánh xạ update payload nếu có
    if (typeof this.getUpdate === 'function') {
      const update = this.getUpdate();
      if (update && typeof update === 'object') {
        this.setUpdate(mapAliases(update, aliases));
      }
    }

    // 3. Ánh xạ sort
    if (this.options && this.options.sort && typeof this.options.sort === 'object') {
      this.options.sort = mapAliases(this.options.sort, aliases);
    }

    // 4. Ánh xạ populate options
    if (this._mongooseOptions && this._mongooseOptions.populate) {
      this._mongooseOptions.populate = mapPopulate(this._mongooseOptions.populate, aliases);
    }

    // 5. Ánh xạ projection / select fields
    if (this._fields && typeof this._fields === 'object') {
      this._fields = mapAliases(this._fields, aliases);
    }
  });

  // Hỗ trợ Model.populate tĩnh
  schema.static('populate', function (docs, paths, options) {
    const aliases = this.schema?.aliases;
    if (aliases && paths) {
      if (typeof paths === 'string') {
        paths = aliases[paths] || paths;
      } else if (Array.isArray(paths)) {
        paths = paths.map((p) => {
          if (typeof p === 'string') return aliases[p] || p;
          if (p && typeof p === 'object' && p.path) {
            return { ...p, path: aliases[p.path] || p.path };
          }
          return p;
        });
      } else if (typeof paths === 'object' && paths.path) {
        paths = { ...paths, path: aliases[paths.path] || paths.path };
      }
    }
    return mongoose.Model.populate.call(this, docs, paths, options);
  });

  // Hỗ trợ aggregate pipeline
  schema.pre('aggregate', function () {
    const aliases = this.schema?.aliases;
    if (!aliases || Object.keys(aliases).length === 0) return;

    const pipeline = this.pipeline();
    if (Array.isArray(pipeline)) {
      for (const stage of pipeline) {
        if (stage.$match) {
          stage.$match = mapAliases(stage.$match, aliases);
        }
        if (stage.$sort) {
          stage.$sort = mapAliases(stage.$sort, aliases);
        }
      }
    }
  });

  // Hỗ trợ tự động gắn aliases cho kết quả .lean()
  const postOps = ['find', 'findOne', 'findOneAndUpdate'];
  schema.post(postOps, function (res) {
    if (!this._mongooseOptions?.lean || !res) return;
    const aliases = this.schema?.aliases;
    if (!aliases || Object.keys(aliases).length === 0) return;

    const copyAliases = (obj) => {
      if (!obj || typeof obj !== 'object' || obj instanceof Date || obj instanceof mongoose.Types.ObjectId) {
        return obj;
      }
      if (Array.isArray(obj)) {
        return obj.map(copyAliases);
      }
      for (const [alias, real] of Object.entries(aliases)) {
        if (obj[real] !== undefined && obj[alias] === undefined) {
          obj[alias] = obj[real];
        } else if (obj[alias] !== undefined && obj[real] === undefined) {
          obj[real] = obj[alias];
        }
      }
      return obj;
    };

    copyAliases(res);
  });
}

module.exports = {
  schemaAliasPlugin,
  mapAliases,
  mapPopulate,
};
