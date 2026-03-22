const fs = require("fs");
const path = require("path");

class AgentMemoryStore {
  constructor({ filePath, maxEntriesPerEns = 50 }) {
    this.filePath = filePath;
    this.maxEntriesPerEns = maxEntriesPerEns;
    this.ensureFile();
  }

  ensureFile() {
    const parentDir = path.dirname(this.filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, "{}\n");
    }
  }

  readAll() {
    this.ensureFile();
    const raw = fs.readFileSync(this.filePath, "utf8") || "{}";
    return JSON.parse(raw);
  }

  writeAll(entries) {
    fs.writeFileSync(this.filePath, `${JSON.stringify(entries, null, 2)}\n`);
    return entries;
  }

  append(ensName, entry) {
    const normalizedEns = String(ensName || "unknown.eth").trim().toLowerCase();
    const records = this.readAll();
    const current = Array.isArray(records[normalizedEns]) ? records[normalizedEns] : [];
    const nextEntry = {
      createdAt: new Date().toISOString(),
      ...entry,
    };

    current.unshift(nextEntry);
    records[normalizedEns] = current.slice(0, this.maxEntriesPerEns);
    this.writeAll(records);
    return nextEntry;
  }

  latest(ensName) {
    const normalizedEns = String(ensName || "unknown.eth").trim().toLowerCase();
    const records = this.readAll();
    const list = Array.isArray(records[normalizedEns]) ? records[normalizedEns] : [];
    return list[0] || null;
  }

  list(ensName) {
    const normalizedEns = String(ensName || "unknown.eth").trim().toLowerCase();
    const records = this.readAll();
    return Array.isArray(records[normalizedEns]) ? records[normalizedEns] : [];
  }

  clear(ensName) {
    const records = this.readAll();
    if (ensName) {
      const normalizedEns = String(ensName).trim().toLowerCase();
      delete records[normalizedEns];
      this.writeAll(records);
      return;
    }

    this.writeAll({});
  }
}

module.exports = {
  AgentMemoryStore,
};