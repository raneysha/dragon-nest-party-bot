// Persistent tracker for loot items on a finished party's recap message,
// keyed by that message's ID. Kept separate from partyManager because by
// the time someone marks an item "sold", the party itself has already
// been deleted — this only needs to live as long as the recap message
// does. Backed by a JSON file on disk (data/loot.json) so records survive
// a bot restart, same pattern as characterManager.js.

const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const DATA_FILE = path.join(DATA_DIR, "loot.json");

const lootRecords = new Map();

// Loads loot.json into memory at startup. If the file doesn't exist yet
// (first run) or is unreadable, starts empty instead of crashing.
function loadFromDisk() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    for (const [messageId, record] of Object.entries(parsed)) {
      lootRecords.set(messageId, record);
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("Couldn't read loot.json, starting with no loot records:", err.message);
    }
  }
}

// Writes the full in-memory loot record set back out to disk. Called
// after every mutation so the file is always current.
function saveToDisk() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const asObject = Object.fromEntries(lootRecords);
    fs.writeFileSync(DATA_FILE, JSON.stringify(asObject, null, 2));
  } catch (err) {
    console.error("Couldn't save loot.json:", err.message);
  }
}

loadFromDisk();

// record shape: { activity, dateCleared, lootHolder, rosterText,
// leaderExtra, items: [{ name, sold, soldTo }] }
function createLoot(messageId, record) {
  lootRecords.set(messageId, record);
  saveToDisk();
}

function getLoot(messageId) {
  return lootRecords.get(messageId);
}

// Removes a loot record entirely — used when an admin deletes the
// recap thread, so the JSON file doesn't keep a record for a thread
// that no longer exists.
function deleteLoot(messageId) {
  const existed = lootRecords.delete(messageId);
  if (existed) saveToDisk();
  return existed;
}

// Marks one item sold by index into record.items, along with the price
// it sold for. Returns the updated record, or false if the
// message/index isn't tracked (already expired, bad index, etc).
function markSold(messageId, index, userId, price = null) {
  const record = lootRecords.get(messageId);
  if (!record || !record.items[index]) return false;
  record.items[index].sold = true;
  record.items[index].soldTo = userId;
  record.items[index].price = price;
  saveToDisk();
  return record;
}

// Marks one roster entry paid by index into record.roster. Returns the
// updated record, or false if the message/index isn't tracked.
function markPaid(messageId, index) {
  const record = lootRecords.get(messageId);
  if (!record || !record.roster || !record.roster[index]) return false;
  record.roster[index].paid = true;
  saveToDisk();
  return record;
}

// Sets the STAMP count for one roster entry by index into record.roster.
// Overwrites any previous value (re-picking the same member updates it
// rather than stacking). Returns the updated record, or false if the
// message/index isn't tracked.
function markStamp(messageId, index, amount) {
  const record = lootRecords.get(messageId);
  if (!record || !record.roster || !record.roster[index]) return false;
  record.roster[index].stamp = amount;
  saveToDisk();
  return record;
}

// Changes who's marked as the loot holder for a finished party's recap.
// Only meant to be called after the caller has already verified the
// requester is the party leader — this function itself just does the
// data update. Returns the updated record, or false if not tracked.
function setLootHolder(messageId, userId) {
  const record = lootRecords.get(messageId);
  if (!record) return false;
  record.lootHolder = userId;
  saveToDisk();
  return record;
}

module.exports = { createLoot, getLoot, deleteLoot, markSold, markPaid, markStamp, setLootHolder };