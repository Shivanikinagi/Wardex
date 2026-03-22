const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

class ShareLinkStore {
  constructor({ filePath }) {
    this.filePath = filePath;
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

  create({ blinkUrl, createdBy = "wardex", meta = {} }) {
    const entries = this.readAll();
    const id = crypto.randomBytes(5).toString("hex");
    const entry = {
      id,
      blinkUrl,
      createdBy,
      meta,
      createdAt: new Date().toISOString(),
    };

    entries[id] = entry;
    this.writeAll(entries);
    return entry;
  }

  get(id) {
    const entries = this.readAll();
    return entries[String(id || "").trim()] || null;
  }
}

module.exports = {
  ShareLinkStore,
};
