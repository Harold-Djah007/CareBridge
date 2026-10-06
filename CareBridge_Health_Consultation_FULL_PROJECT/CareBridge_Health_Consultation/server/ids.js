import crypto from "node:crypto";

// Keep IDs free of separators because legacy conversation room names join user IDs with '-'.
export const newId = (prefix) => `${prefix}${crypto.randomBytes(16).toString("hex")}`;
