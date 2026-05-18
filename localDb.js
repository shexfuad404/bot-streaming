const fs = require('fs');
const path = require('path');

const DEFAULT_DATA = {
  config: [],
  limits: [],
  balance: []
};

function ensureFile(filePath) {
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(DEFAULT_DATA, null, 2), 'utf8');
  }
}

function loadData(filePath) {
  ensureFile(filePath);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fs.writeFileSync(filePath, JSON.stringify(DEFAULT_DATA, null, 2), 'utf8');
    return { ...DEFAULT_DATA };
  }
}

function saveData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function matchesQuery(document, query) {
  return Object.entries(query).every(([key, value]) => document[key] === value);
}

function createLocalDb(filePath) {
  let data = loadData(filePath);

  const collection = (name) => {
    if (!data[name]) data[name] = [];

    return {
      find: (query = {}) => ({
        toArray: async () => data[name].filter((document) => matchesQuery(document, query)),
      }),
      findOne: async (query = {}) => data[name].find((document) => matchesQuery(document, query)) || null,
      insertOne: async (document) => {
        data[name].push(document);
        saveData(filePath, data);
        return { acknowledged: true, insertedId: document._id || null };
      },
      deleteOne: async (query = {}) => {
        const index = data[name].findIndex((document) => matchesQuery(document, query));
        if (index === -1) {
          return { deletedCount: 0 };
        }
        data[name].splice(index, 1);
        saveData(filePath, data);
        return { deletedCount: 1 };
      },
      updateOne: async (filter = {}, update = {}, options = {}) => {
        const index = data[name].findIndex((document) => matchesQuery(document, filter));
        if (index !== -1) {
          if (update.$set) {
            data[name][index] = { ...data[name][index], ...update.$set };
            saveData(filePath, data);
          }
          return { matchedCount: 1, modifiedCount: 1, upsertedId: null };
        }

        if (options.upsert) {
          const newDocument = { ...filter, ...(update.$set || {}) };
          data[name].push(newDocument);
          saveData(filePath, data);
          return { matchedCount: 0, modifiedCount: 0, upsertedId: newDocument._id || null };
        }

        return { matchedCount: 0, modifiedCount: 0, upsertedId: null };
      },
    };
  };

  return { collection };
}

module.exports = { createLocalDb };