// Routes every `party:`-prefixed interaction (buttons, select menus,
// modals) to its handler. This file intentionally stays thin — the actual
// logic lives in the domain-specific modules below:
//
//   shared/   — permission checks and helpers used by both party & loot code
//   party/    — everything about the party listing itself (join, leave,
//               kick, assign, ping, finish, disband)
//   loot/     — everything about the post-finish loot recap thread
//               (marking items sold, paying gaji, stamps, changing holder)
const { MessageFlags } = require("discord.js");
const { getParty, joinRole, removeMember } = require("./partyManager");
const { buildPartyEmbed, buildPartyButtons } = require("./uiBuilders");
const { hasSubclasses } = require("./roleClasses");
const { buildSubclassPrompt } = require("./shared/classPicker");

const {
  handlePing,
  handleAssign,
  handleKick,
  handleFinish,
  handleDisband,
  handleFinishConfirm,
} = require("./party/partyButtonActions");
const {
  handleAssignRole,
  handleAssignUser,
  handleAssignClass,
  handleKickSelect,
  handleFinishHolder,
  handlePickClass,
} = require("./party/partySelectActions");
const { handlePingModalSubmit } = require("./party/partyModalActions");
const { handleFinishModalSubmit, buildFinishThreadName } = require("./party/partyFinishFlow");

const {
  handleSoldBtn,
  handleGajiBtn,
  handleStampBtn,
  handleDeleteLootBtn,
  handleDeleteLootConfirm,
  handleChangeHolderBtn,
} = require("./loot/lootButtonActions");
const {
  handleSoldSelect,
  handleGajiSelect,
  handleStampSelect,
  handleChangeHolderSelect,
} = require("./loot/lootSelectActions");
const { handleSoldPrice, handleStampModal } = require("./loot/lootModalActions");

// Button actions that key off a loot recap message (recapMessageId in
// parts[2]) rather than a live party.
const LOOT_BUTTON_ACTIONS = {
  soldbtn: handleSoldBtn,
  gajibtn: handleGajiBtn,
  stampbtn: handleStampBtn,
  deletelootbtn: handleDeleteLootBtn,
  deletelootconfirm: handleDeleteLootConfirm,
  changeholderbtn: handleChangeHolderBtn,
};

// Button actions that are fully self-contained once handed a resolved
// `party` object — each owns its own reply/update.
const PARTY_BUTTON_ACTIONS = {
  ping: handlePing,
  assign: handleAssign,
  kick: handleKick,
  finish: handleFinish,
  disband: handleDisband,
};

async function handleButton(interaction) {
  const parts = interaction.customId.split(":");
  const action = parts[1];

  if (LOOT_BUTTON_ACTIONS[action]) {
    return LOOT_BUTTON_ACTIONS[action](interaction, parts);
  }

  // finishconfirm resolves its own party from parts[3] rather than
  // interaction.message.id, since it's shown on a follow-up reply, not
  // the party message itself.
  if (action === "finishconfirm") {
    return handleFinishConfirm(interaction, parts);
  }

  const roleKey = parts[2];
  const party = getParty(interaction.message.id);

  if (!party) {
    return interaction.reply({
      content: "This party no longer exists.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (PARTY_BUTTON_ACTIONS[action]) {
    return PARTY_BUTTON_ACTIONS[action](interaction, party);
  }

  // Join and Leave are the only two actions that fall through to a shared
  // "refresh the party embed" step below instead of fully owning their
  // own response, since both silently succeed (no state to report beyond
  // the updated roster) unless something went wrong.
  if (action === "join") {
    if (hasSubclasses(roleKey)) {
      return interaction.reply(buildSubclassPrompt(party.messageId, roleKey));
    }
    const result = joinRole(party.messageId, interaction.user.id, roleKey);
    if (result === "full") {
      return interaction.reply({
        content: "That role just filled up — try another one!",
        flags: MessageFlags.Ephemeral,
      });
    }
  } else if (action === "leave") {
    const removed = removeMember(party.messageId, interaction.user.id);
    if (!removed) {
      return interaction.reply({
        content: "You're not currently signed up for this party.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  return interaction.update({
    embeds: [buildPartyEmbed(party)],
    components: buildPartyButtons(party),
  });
}

const PARTY_SELECT_ACTIONS = {
  assignrole: handleAssignRole,
  assignuser: handleAssignUser,
  assignclass: handleAssignClass,
  kickselect: handleKickSelect,
  finishholder: handleFinishHolder,
  pickclass: handlePickClass,
};

const LOOT_SELECT_ACTIONS = {
  soldselect: handleSoldSelect,
  gajiselect: handleGajiSelect,
  stampselect: handleStampSelect,
  changeholderselect: handleChangeHolderSelect,
};

async function handleSelectMenu(interaction) {
  const parts = interaction.customId.split(":");
  const action = parts[1];

  if (PARTY_SELECT_ACTIONS[action]) {
    return PARTY_SELECT_ACTIONS[action](interaction, parts);
  }
  if (LOOT_SELECT_ACTIONS[action]) {
    return LOOT_SELECT_ACTIONS[action](interaction, parts);
  }
}

const PARTY_MODAL_ACTIONS = {
  finishmodal: handleFinishModalSubmit,
  pingmodal: handlePingModalSubmit,
};

const LOOT_MODAL_ACTIONS = {
  soldprice: handleSoldPrice,
  stampmodal: handleStampModal,
};

async function handleModalSubmit(interaction) {
  const parts = interaction.customId.split(":");
  const action = parts[1];

  if (PARTY_MODAL_ACTIONS[action]) {
    return PARTY_MODAL_ACTIONS[action](interaction, parts);
  }
  if (LOOT_MODAL_ACTIONS[action]) {
    return LOOT_MODAL_ACTIONS[action](interaction, parts);
  }
}

module.exports = { handleButton, handleSelectMenu, handleModalSubmit, buildFinishThreadName };
