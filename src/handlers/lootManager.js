// Tracks loot items for a finished party's recap message, keyed by that
// message's ID. Kept separate from partyManager because by the time
// someone marks an item "sold", the party itself has already been
// deleted — this only needs to live as long as the recap message does.

const lootRecords = new Map();

// record shape: { activity, dateCleared, lootHolder, rosterText,
// leaderExtra, items: [{ name, sold, soldTo }] }
function createLoot(messageId, record) {
  lootRecords.set(messageId, record);
}

function getLoot(messageId) {
  return lootRecords.get(messageId);
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
  return record;
}

// Marks one roster entry paid by index into record.roster. Returns the
// updated record, or false if the message/index isn't tracked.
function markPaid(messageId, index) {
  const record = lootRecords.get(messageId);
  if (!record || !record.roster || !record.roster[index]) return false;
  record.roster[index].paid = true;
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
  return record;
}

module.exports = { createLoot, getLoot, markSold, markPaid, markStamp, setLootHolder };
