// In-memory store of active party listings, keyed by the Discord message ID
// that hosts the party's embed. Not persisted to disk — parties are meant
// to be short-lived (form up, run it, finish it), so a restart clearing
// them is an acceptable trade-off for staying simple.

const parties = new Map();

const ROLE_LABELS = {
  tank: "🛡️ Paladin",
  healer: "💉 Healer",
  swordmaster: "⚔️ Swordmaster",
  mercenary: "🔨 Mercenary",
  sorceress: "🔥 Sorceress",
  acrobat: "🏹 Acrobat",
  flexible: "🎯 Flexible",
};

// Used when a server hasn't configured a custom default via
// /config set-default-party.
const FACTORY_DEFAULT_ROLE_CAPS = {
  tank: 1,
  healer: 1,
  swordmaster: 1,
  mercenary: 1,
  sorceress: 1,
  acrobat: 1,
  flexible: 2,
};

// roleCaps: { tank: 1, healer: 1, ... } — any role with cap 0 is simply
// omitted from party.roles, so it never shows up as a joinable slot.
function createParty({ messageId, channelId, leaderId, activity, time, note, nestType, roleCaps }) {
  const roles = {};
  for (const [roleKey, cap] of Object.entries(roleCaps)) {
    if (cap > 0) {
      roles[roleKey] = { cap, members: [] };
    }
  }

  const party = {
    messageId,
    channelId,
    leaderId,
    activity,
    time: time || null,
    note: note || null,
    nestType: nestType || null,
    roles,
    createdAt: Date.now(),
  };
  parties.set(messageId, party);
  return party;
}

function getParty(messageId) {
  return parties.get(messageId);
}

function getAllParties() {
  return Array.from(parties.values());
}

function deleteParty(messageId) {
  return parties.delete(messageId);
}

// Moves a party's data to a new message ID — used by /party recall, which
// deletes the old (buried) message and posts a fresh one so it's easy to
// find again, without losing the roster.
function rekeyParty(oldMessageId, newMessageId) {
  const party = parties.get(oldMessageId);
  if (!party) return null;
  parties.delete(oldMessageId);
  party.messageId = newMessageId;
  parties.set(newMessageId, party);
  return party;
}

// Updates a party's editable metadata (currently activity/title and time).
// Pass only the fields you want changed — omitted (undefined) fields are
// left as-is. An empty string for `time` clears it back to "not set"
// (shown as no time line in the embed), matching how /party create treats
// a blank time option. `activity` is never cleared this way since a party
// always needs a name; validate that before calling if needed.
// Returns the updated party, or null if it no longer exists.
function updateParty(messageId, { activity, time } = {}) {
  const party = parties.get(messageId);
  if (!party) return null;
  if (activity !== undefined) party.activity = activity;
  if (time !== undefined) party.time = time || null;
  return party;
}

// Returns "full" if the role is already at capacity, "joined" if the
// join succeeded. If the user is already in a different role, they're
// moved (removed from the old one first) rather than duplicated.
function joinRole(messageId, userId, roleKey, subclass = null) {
  const party = parties.get(messageId);
  if (!party) return "no-such-party";
  const role = party.roles[roleKey];
  if (!role) return "no-such-role";
  if (role.members.length >= role.cap) return "full";

  removeMember(messageId, userId);
  role.members.push({ userId, subclass });
  return "joined";
}

// Removes a user from whichever role they're currently in (if any).
// Returns true if they were found and removed.
function removeMember(messageId, userId) {
  const party = parties.get(messageId);
  if (!party) return false;
  for (const role of Object.values(party.roles)) {
    const idx = role.members.findIndex((m) => m.userId === userId);
    if (idx !== -1) {
      role.members.splice(idx, 1);
      return true;
    }
  }
  return false;
}

function isFull(party) {
  return Object.values(party.roles).every((role) => role.members.length >= role.cap);
}

function isMember(party, userId) {
  return Object.values(party.roles).some((role) => role.members.some((m) => m.userId === userId));
}

function getAllMemberIds(party) {
  const ids = [];
  for (const role of Object.values(party.roles)) {
    for (const member of role.members) ids.push(member.userId);
  }
  return ids;
}

module.exports = {
  ROLE_LABELS,
  FACTORY_DEFAULT_ROLE_CAPS,
  createParty,
  getParty,
  getAllParties,
  deleteParty,
  rekeyParty,
  updateParty,
  joinRole,
  removeMember,
  isFull,
  isMember,
  getAllMemberIds,
};
