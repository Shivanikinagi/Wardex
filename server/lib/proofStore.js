const fs = require("fs");
const path = require("path");

class ProofStore {
  constructor({ filePath, maxEntries = 250 }) {
    this.filePath = filePath;
    this.maxEntries = maxEntries;
    this.ensureFile();
  }

  ensureFile() {
    const parentDir = path.dirname(this.filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, "[]\n");
    }
  }

  readAll() {
    this.ensureFile();
    return JSON.parse(fs.readFileSync(this.filePath, "utf8") || "[]");
  }

  writeAll(entries) {
    fs.writeFileSync(this.filePath, `${JSON.stringify(entries, null, 2)}\n`);
  }

  append(entry) {
    const entries = this.readAll();
    entries.unshift(entry);
    this.writeAll(entries.slice(0, this.maxEntries));
    return entry;
  }

  updateById(proofId, patch) {
    const entries = this.readAll();
    const index = entries.findIndex((entry) => entry.id === proofId);
    if (index === -1) {
      return null;
    }

    entries[index] = {
      ...entries[index],
      ...patch,
    };
    this.writeAll(entries);
    return entries[index];
  }

  getById(proofId) {
    return this.readAll().find((entry) => entry.id === proofId) || null;
  }

  clear() {
    this.writeAll([]);
  }
}

module.exports = {
  ProofStore,
};
