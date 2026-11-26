// Every user-facing runtime string in the bot, keyed by feature area, in
// both supported languages. Game-specific proper nouns (role names like
// "Paladin", class names like "Guardian", and short roster codes like
// PL/PR/SM/DPS) are intentionally left untranslated in both locales.
//
// Params use {curly} placeholders, filled in by the t() helper in
// i18n/index.js.

const en = {
  // ---- shared / generic ----
  "common.partyGone": "This party no longer exists.",
  "common.somethingWentWrong": "Something went wrong handling that.",

  // ---- /config ----
  "config.adminOnly": "Only server admins can use this command.",
  "config.setLootChannel.confirm": "✅ Loot threads from `/party finish` will now be created in {channel}.",
  "config.clearLootChannel.confirm": "✅ Loot channel cleared — threads will go back to being created in the party's own channel.",
  "config.setDefaultParty.needsRole": "The default composition needs at least one role slot — can't set everything to 0.",
  "config.setDefaultParty.confirm": "✅ Default party composition updated for this server:\n{comp}",
  "config.clearDefaultParty.confirm": "✅ Reset to the bot's built-in default:\n{comp}",
  "config.view.lootChannelUnset": "_not set (uses the party's own channel)_",
  "config.view.compCustom": "{comp} _(custom)_",
  "config.view.compBuiltIn": "{comp} _(built-in default)_",
  "config.view.summary": "**Server settings:**\nLoot channel: {lootChannel}\nDefault party: {comp}\nBot language: {language}",
  "config.language.confirm": "✅ Bot language for this server is now **{language}**.",
  "config.language.english": "English",
  "config.language.indonesian": "Indonesian",

  // ---- /character ----
  "character.add.invalidClass": "**{className}** isn't a recognized class — please pick one from the suggestions as you type.",
  "character.add.duplicate": "You already have a character named **{ign}** registered.",
  "character.add.confirm": "✅ Registered **{ign}** ({className}).",
  "character.list.emptySelf": "You haven't registered any characters yet.",
  "character.list.emptyOther": "{username} hasn't registered any characters yet.",
  "character.list.title": "🗡️ {username}'s characters",
  "character.list.footer": "{count} character{plural} registered",
  "character.search.empty": "Nobody in this server has registered a **{className}** yet.",
  "character.search.title": "🔎 {className} players",
  "character.search.footer": "Players: {players} · Characters: {characters}",
  "character.search.more": "…and {count} more",
  "character.remove.notFound": "You don't have a character named **{ign}** registered.",
  "character.remove.confirm": "🗑️ Removed **{ign}**.",

  // ---- /party create ----
  "party.create.needsRole": "You need at least one open role slot (paladins, healers, swordmasters, mercenaries, sorceresses, acrobats, or flexible) to create a party.",
  "party.create.creating": "Creating party...",
  // ---- /party list ----
  "party.list.empty": "No active parties in this channel right now. Start one with `/party create`.",
  "party.list.header": "**Active parties:**\n{lines}",
  "party.list.line": "• **{activity}**{time} (led by <@{leaderId}>)",
  // ---- /party recall ----
  "party.recall.empty": "No active parties in this channel to recall.",
  "party.recall.noMatch": "No active party matches \"{query}\". Active parties here:\n{names}",
  "party.recall.multiMatch": "More than one party matches \"{query}\" — be more specific:\n{names}",
  "party.recall.needsQuery": "There's more than one active party here — specify which with `/party recall activity:`\n{names}",
  "party.recall.recalling": "Recalling party...",

  // ---- party embed ----
  "party.embed.full": "Party is full!",
  "party.embed.tapToJoin": "Tap a role below to join",
  "party.embed.when": "🕒 **When:** {time}",
  "party.embed.leader": "👑 **Leader:** <@{leaderId}>",
  "party.embed.note": "📝 **Note:** {note}",
  "party.embed.status": "Status : {status}",
  "party.embed.statusFull": "FULL",
  "party.embed.statusOpen": "OPEN",
  "party.embed.members": "Members : {joined}/{total}",
  "party.embed.raidNest": "Raid Nest : {nestType}",
  "party.embed.openSlot": "_open_",

  // ---- party buttons ----
  "party.buttons.ping": "Ping",
  "party.buttons.leave": "Leave",
  "party.buttons.assign": "Assign",
  "party.buttons.kick": "Kick",
  "party.buttons.finish": "Finish",
  "party.buttons.disband": "Disband",
  "party.buttons.edit": "Edit",

  // ---- join / leave ----
  "party.join.roleFull": "That role just filled up — try another one!",
  "party.leave.notSignedUp": "You're not currently signed up for this party.",

  // ---- class picker ----
  "party.classPicker.placeholderMulti": "Choose your class ({page}/{total})",
  "party.classPicker.placeholderSingle": "Choose your {role} class",
  "party.classPicker.prompt": "Choose your {role} class:",
  "party.pickclass.roleFull": "That role just filled up — try another one!",
  "party.pickclass.confirm": "Joined as **{subclass}** {role}!",

  // ---- ping ----
  "party.ping.needToJoin": "You need to join the party before you can ping it.",
  "party.ping.modalTitle": "Ping the party",
  "party.ping.modalLabel": "What do you want to say?",
  "party.ping.modalPlaceholder": "e.g. Forming up now, get in voice!",
  "party.ping.broadcast": "📣 **{username}** on **{activity}**:\n{message}\n\n{mentions}",

  // ---- assign ----
  "party.assign.denied": "Only the party leader or a server admin can assign members to a role.",
  "party.assign.allFull": "Every role is already full — there's nothing open to assign someone to.",
  "party.assign.rolePrompt": "Which open role do you want to assign someone to?",
  "party.assign.roleMenuPlaceholder": "Which role do you want to fill?",
  "party.assign.rolePlaceholder": "{role} ({open} open)",
  "party.assign.roleJustFilled": "That role just filled up — try a different one.",
  "party.assign.userPlaceholder": "Who should fill {role}?",
  "party.assign.userPrompt": "Pick who to assign to **{role}**:",
  "party.assign.classPromptMulti": "Class for {username} ({page}/{total})",
  "party.assign.classPromptSingle": "Which class for {username}?",
  "party.assign.classQuestion": "Which class should <@{userId}> be assigned as {role}?",
  "party.assign.confirmNoClass": "Assigned <@{userId}> to {role}.",
  "party.assign.confirmWithClass": "Assigned <@{userId}> as **{subclass}** {role}.",

  // ---- kick ----
  "party.kick.denied": "Only the party leader or a server admin can kick members.",
  "party.kick.nobodyToKick": "There's no one to kick — the party has no members besides you.",
  "party.kick.prompt": "Who do you want to kick from the party?",
  "party.kick.placeholder": "Choose a member to kick",
  "party.kick.alreadyLeft": "That member already left the party.",
  "party.kick.confirm": "Kicked <@{userId}> from the party.",

  // ---- finish ----
  "party.finish.denied": "Only the party leader or a server admin can finish this party.",
  "party.finish.holderPrompt": "Who's carrying the loot from this party?",
  "party.finish.holderPlaceholder": "Who's carrying the loot?",
  "party.finish.modalTitle": "Finish party",
  "party.finish.lootListLabel": "What loot dropped?",
  "party.finish.lootListPlaceholder": "One item per line",
  "party.finish.dateLabel": "Date cleared",
  "party.finish.datePlaceholder": "e.g. 07/10/2026",
  "party.finish.threadFailed": "Party was finished, but I couldn't create the loot thread — check that I have the \"Create Public Threads\" permission (or \"Create Posts\" for forum channels) there.",
  "party.finish.threadCreated": "✅ Loot thread created: {thread}\n\nDo you also want to disband this party listing?",

  // ---- finish confirm ----
  "party.finishconfirm.gone": "This party listing is already gone.",
  "party.finishconfirm.denied": "Only the party leader or a server admin can decide this.",
  "party.finishconfirm.keepOpen": "👍 Party listing stays open — feel free to keep organizing it.",
  "party.finishconfirm.disbanded": "💥 Party listing disbanded.",
  "party.finishconfirm.yes": "Yes, disband",
  "party.finishconfirm.no": "No, keep it open",

  // ---- disband ----
  "party.disband.denied": "Only the party leader or a server admin can disband this party.",
  "party.disband.confirm": "💥 This party has been disbanded.",

  // ---- edit ----
  "party.edit.denied": "Only the party leader or a server admin can edit this party.",
  "party.edit.modalTitle": "Edit party",
  "party.edit.activityLabel": "Activity / Party name",
  "party.edit.timeLabel": "Time",
  "party.edit.timePlaceholder": "e.g. 8 PM server time",
  "party.edit.confirm": "✅ Party updated.",

  // ---- loot embed ----
  "loot.embed.title": "📦 Loot recap — {activity}",
  "loot.embed.itemsNone": "_none_",
  "loot.embed.itemSold": "✅ ~~{name}~~{price}",
  "loot.embed.itemUnsold": "{index}. {name}",
  "loot.embed.totalGold": "\n**Total gold:** {total}{approx}",
  "loot.embed.totalGoldApprox": " (approx — some prices couldn't be read)",
  "loot.embed.description": "**Date cleared:** {dateCleared}\n**Loot holder:** <@{lootHolder}>\n**Loot:**\n{items}{total}",
  "loot.embed.stampFieldName": "🎟️ STAMP",
  "loot.embed.totalGoldStamp": "**Total Gold Stamp:** {total}",
  "loot.embed.totalGaji": "**Total Payout:** {total}",

  // ---- loot buttons ----
  "loot.buttons.sold": "SOLD",
  "loot.buttons.gaji": "PAYOUT",
  "loot.buttons.stamp": "STAMP",
  "loot.buttons.changeHolder": "Change Loot Holder",
  "loot.buttons.delete": "Delete",

  // ---- sold ----
  "loot.sold.recordGone": "Loot data for this party is no longer available.",
  "loot.sold.notHolder": "Only **<@{lootHolder}>** (the loot holder) can mark items sold.",
  "loot.sold.allSold": "All items are already marked sold.",
  "loot.sold.prompt": "Which item sold?",
  "loot.sold.placeholder": "Pick the item that sold",
  "loot.sold.modalTitle": "Sale price",
  "loot.sold.priceLabel": "Price for \"{item}\"",
  "loot.sold.pricePlaceholder": "e.g. 500k, 1.2m, 750k",
  "loot.sold.confirm": "✅ Marked sold: **{item}** — {price}",

  // ---- gaji (payout) ----
  "loot.gaji.recordGone": "This party's data is no longer available.",
  "loot.gaji.notHolder": "Only **<@{lootHolder}>** (the loot holder) can mark payouts.",
  "loot.gaji.notAllSold": "Every item needs to be sold before payouts can be marked.",
  "loot.gaji.allPaid": "Everyone has already been paid.",
  "loot.gaji.prompt": "Who received their payout?",
  "loot.gaji.placeholder": "Pick who got paid",
  "loot.gaji.confirm": "✅ Payout given to <@{userId}>",

  // ---- stamp ----
  "loot.stamp.recordGone": "Loot data for this party is no longer available.",
  "loot.stamp.notHolder": "Only **<@{lootHolder}>** (the loot holder) can set STAMP.",
  "loot.stamp.noRoster": "There's no one in this party's roster.",
  "loot.stamp.prompt": "Set STAMP for who?",
  "loot.stamp.placeholder": "Pick a member",
  "loot.stamp.modalTitle": "Set STAMP",
  "loot.stamp.amountLabel": "STAMP amount for {username}",
  "loot.stamp.amountPlaceholder": "e.g. 5",
  "loot.stamp.notANumber": "\"{raw}\" isn't a valid number. Try again with just a number, e.g. 5.",
  "loot.stamp.confirm": "🎟️ STAMP for <@{userId}> set to **{value}**.",

  // ---- delete loot ----
  "loot.delete.recordGone": "Loot data for this party is no longer available.",
  "loot.delete.adminOnly": "Only a server admin can delete this loot thread.",
  "loot.delete.confirmPrompt": "⚠️ Are you sure you want to delete this loot thread? This can't be undone.",
  "loot.delete.confirmYes": "Yes, delete thread",
  "loot.delete.confirmNo": "Cancel",
  "loot.delete.cancelled": "👍 Cancelled — thread was not deleted.",
  "loot.delete.deleting": "🗑️ Deleting thread...",
  "loot.delete.failed": "Loot data was deleted, but the thread itself couldn't be removed — check the bot's Manage Threads permission.",

  // ---- change holder ----
  "loot.changeHolder.recordGone": "Loot data for this party is no longer available.",
  "loot.changeHolder.leaderOnly": "Only the party leader can change the loot holder.",
  "loot.changeHolder.noRoster": "There's no one in this party's roster.",
  "loot.changeHolder.prompt": "Who's the new loot holder?",
  "loot.changeHolder.placeholder": "Pick the new loot holder",
  "loot.changeHolder.currentTag": "⭐ {username} (current)",
  "loot.changeHolder.confirm": "✅ Loot holder changed to <@{userId}>.",
};

const id = {
  // ---- shared / generic ----
  "common.partyGone": "Party ini sudah tidak tersedia.",
  "common.somethingWentWrong": "Terjadi kesalahan saat memproses ini.",

  // ---- /config ----
  "config.adminOnly": "Hanya admin server yang bisa menggunakan command ini.",
  "config.setLootChannel.confirm": "✅ Thread loot dari `/party finish` sekarang akan dibuat di {channel}.",
  "config.clearLootChannel.confirm": "✅ Channel loot dihapus — thread akan kembali dibuat di channel party itu sendiri.",
  "config.setDefaultParty.needsRole": "Komposisi default butuh minimal satu role — tidak bisa semuanya 0.",
  "config.setDefaultParty.confirm": "✅ Komposisi party default untuk server ini diperbarui:\n{comp}",
  "config.clearDefaultParty.confirm": "✅ Direset ke default bawaan bot:\n{comp}",
  "config.view.lootChannelUnset": "_belum diset (pakai channel party itu sendiri)_",
  "config.view.compCustom": "{comp} _(custom)_",
  "config.view.compBuiltIn": "{comp} _(default bawaan)_",
  "config.view.summary": "**Pengaturan server:**\nChannel loot: {lootChannel}\nParty default: {comp}\nBahasa bot: {language}",
  "config.language.confirm": "✅ Bahasa bot untuk server ini sekarang **{language}**.",
  "config.language.english": "Inggris",
  "config.language.indonesian": "Indonesia",

  // ---- /character ----
  "character.add.invalidClass": "**{className}** bukan class yang dikenali — silakan pilih salah satu dari saran saat mengetik.",
  "character.add.duplicate": "Kamu sudah punya karakter bernama **{ign}** yang terdaftar.",
  "character.add.confirm": "✅ Terdaftar **{ign}** ({className}).",
  "character.list.emptySelf": "Kamu belum mendaftarkan karakter apapun.",
  "character.list.emptyOther": "{username} belum mendaftarkan karakter apapun.",
  "character.list.title": "🗡️ Karakter {username}",
  "character.list.footer": "{count} karakter terdaftar",
  "character.search.empty": "Belum ada yang mendaftarkan **{className}** di server ini.",
  "character.search.title": "🔎 Pemain {className}",
  "character.search.footer": "Pemain: {players} · Karakter: {characters}",
  "character.search.more": "…dan {count} lainnya",
  "character.remove.notFound": "Kamu tidak punya karakter bernama **{ign}** yang terdaftar.",
  "character.remove.confirm": "🗑️ Dihapus **{ign}**.",

  // ---- /party create ----
  "party.create.needsRole": "Kamu butuh minimal satu role terbuka (paladin, healer, swordmaster, mercenary, sorceress, acrobat, atau flexible) untuk membuat party.",
  "party.create.creating": "Membuat party...",
  // ---- /party list ----
  "party.list.empty": "Tidak ada party aktif di channel ini saat ini. Mulai satu dengan `/party create`.",
  "party.list.header": "**Party aktif:**\n{lines}",
  "party.list.line": "• **{activity}**{time} (dipimpin oleh <@{leaderId}>)",
  // ---- /party recall ----
  "party.recall.empty": "Tidak ada party aktif di channel ini untuk di-recall.",
  "party.recall.noMatch": "Tidak ada party aktif yang cocok dengan \"{query}\". Party aktif di sini:\n{names}",
  "party.recall.multiMatch": "Ada lebih dari satu party yang cocok dengan \"{query}\" — lebih spesifik lagi:\n{names}",
  "party.recall.needsQuery": "Ada lebih dari satu party aktif di sini — tentukan yang mana dengan `/party recall activity:`\n{names}",
  "party.recall.recalling": "Me-recall party...",

  // ---- party embed ----
  "party.embed.full": "Party sudah penuh!",
  "party.embed.tapToJoin": "Tap salah satu role di bawah untuk join",
  "party.embed.when": "🕒 **Waktu:** {time}",
  "party.embed.leader": "👑 **Leader:** <@{leaderId}>",
  "party.embed.note": "📝 **Catatan:** {note}",
  "party.embed.status": "Status : {status}",
  "party.embed.statusFull": "PENUH",
  "party.embed.statusOpen": "TERBUKA",
  "party.embed.members": "Member : {joined}/{total}",
  "party.embed.raidNest": "Raid Nest : {nestType}",
  "party.embed.openSlot": "_kosong_",

  // ---- party buttons ----
  "party.buttons.ping": "Ping",
  "party.buttons.leave": "Keluar",
  "party.buttons.assign": "Assign",
  "party.buttons.kick": "Kick",
  "party.buttons.finish": "Selesai",
  "party.buttons.disband": "Bubarkan",
  "party.buttons.edit": "Edit",

  // ---- join / leave ----
  "party.join.roleFull": "Role itu baru saja penuh — coba yang lain!",
  "party.leave.notSignedUp": "Kamu belum join party ini.",

  // ---- class picker ----
  "party.classPicker.placeholderMulti": "Pilih class kamu ({page}/{total})",
  "party.classPicker.placeholderSingle": "Pilih class {role} kamu",
  "party.classPicker.prompt": "Pilih class {role} kamu:",
  "party.pickclass.roleFull": "Role itu baru saja penuh — coba yang lain!",
  "party.pickclass.confirm": "Join sebagai **{subclass}** {role}!",

  // ---- ping ----
  "party.ping.needToJoin": "Kamu perlu join party dulu sebelum bisa ping.",
  "party.ping.modalTitle": "Ping party",
  "party.ping.modalLabel": "Mau bilang apa?",
  "party.ping.modalPlaceholder": "misal: Otw form, masuk voice ya!",
  "party.ping.broadcast": "📣 **{username}** di **{activity}**:\n{message}\n\n{mentions}",

  // ---- assign ----
  "party.assign.denied": "Hanya party leader atau admin server yang bisa assign member ke role.",
  "party.assign.allFull": "Semua role sudah penuh — tidak ada yang bisa di-assign.",
  "party.assign.rolePrompt": "Mau assign seseorang ke role yang mana?",
  "party.assign.roleMenuPlaceholder": "Role mana yang mau diisi?",
  "party.assign.rolePlaceholder": "{role} ({open} kosong)",
  "party.assign.roleJustFilled": "Role itu baru saja penuh — coba yang lain.",
  "party.assign.userPlaceholder": "Siapa yang mengisi {role}?",
  "party.assign.userPrompt": "Pilih siapa yang di-assign ke **{role}**:",
  "party.assign.classPromptMulti": "Class untuk {username} ({page}/{total})",
  "party.assign.classPromptSingle": "Class apa untuk {username}?",
  "party.assign.classQuestion": "Class apa yang di-assign untuk <@{userId}> sebagai {role}?",
  "party.assign.confirmNoClass": "<@{userId}> di-assign ke {role}.",
  "party.assign.confirmWithClass": "<@{userId}> di-assign sebagai **{subclass}** {role}.",

  // ---- kick ----
  "party.kick.denied": "Hanya party leader atau admin server yang bisa kick member.",
  "party.kick.nobodyToKick": "Tidak ada yang bisa di-kick — party ini tidak punya member selain kamu.",
  "party.kick.prompt": "Siapa yang mau di-kick dari party?",
  "party.kick.placeholder": "Pilih member yang mau di-kick",
  "party.kick.alreadyLeft": "Member itu sudah keluar dari party.",
  "party.kick.confirm": "<@{userId}> di-kick dari party.",

  // ---- finish ----
  "party.finish.denied": "Hanya party leader atau admin server yang bisa menyelesaikan party ini.",
  "party.finish.holderPrompt": "Siapa yang bawa loot dari party ini?",
  "party.finish.holderPlaceholder": "Siapa yang bawa loot?",
  "party.finish.modalTitle": "Selesaikan party",
  "party.finish.lootListLabel": "Lootnya apa aja?",
  "party.finish.lootListPlaceholder": "Satu item per baris",
  "party.finish.dateLabel": "Tanggal clear",
  "party.finish.datePlaceholder": "misal 10/07/2026",
  "party.finish.threadFailed": "Party sudah diselesaikan, tapi thread loot gagal dibuat — cek permission bot \"Create Public Threads\" (atau \"Create Posts\" untuk forum channel) di sana.",
  "party.finish.threadCreated": "✅ Thread loot dibuat: {thread}\n\nMau bubarkan listing party ini juga?",

  // ---- finish confirm ----
  "party.finishconfirm.gone": "Listing party ini sudah tidak ada.",
  "party.finishconfirm.denied": "Hanya party leader atau admin server yang bisa menentukan ini.",
  "party.finishconfirm.keepOpen": "👍 Listing party tetap terbuka — silakan lanjut mengaturnya.",
  "party.finishconfirm.disbanded": "💥 Listing party dibubarkan.",
  "party.finishconfirm.yes": "Ya, bubarkan",
  "party.finishconfirm.no": "Tidak, biarkan terbuka",

  // ---- disband ----
  "party.disband.denied": "Hanya party leader atau admin server yang bisa membubarkan party ini.",
  "party.disband.confirm": "💥 Party ini telah dibubarkan.",

  // ---- edit ----
  "party.edit.denied": "Hanya party leader atau admin server yang bisa mengedit party ini.",
  "party.edit.modalTitle": "Edit party",
  "party.edit.activityLabel": "Activity / Nama party",
  "party.edit.timeLabel": "Waktu",
  "party.edit.timePlaceholder": "misal 8 malam waktu server",
  "party.edit.confirm": "✅ Party diperbarui.",

  // ---- loot embed ----
  "loot.embed.title": "📦 Rekap loot — {activity}",
  "loot.embed.itemsNone": "_kosong_",
  "loot.embed.itemSold": "✅ ~~{name}~~{price}",
  "loot.embed.itemUnsold": "{index}. {name}",
  "loot.embed.totalGold": "\n**Total gold:** {total}{approx}",
  "loot.embed.totalGoldApprox": " (perkiraan — ada harga yang tidak terbaca)",
  "loot.embed.description": "**Tanggal clear:** {dateCleared}\n**Bawa loot:** <@{lootHolder}>\n**Loot:**\n{items}{total}",
  "loot.embed.stampFieldName": "🎟️ STAMP",
  "loot.embed.totalGoldStamp": "**Total Gold Stamp:** {total}",
  "loot.embed.totalGaji": "**Total Gaji:** {total}",

  // ---- loot buttons ----
  "loot.buttons.sold": "SOLD",
  "loot.buttons.gaji": "GAJI",
  "loot.buttons.stamp": "STAMP",
  "loot.buttons.changeHolder": "Ubah Pembawa Loot",
  "loot.buttons.delete": "Delete",

  // ---- sold ----
  "loot.sold.recordGone": "Data loot untuk party ini sudah tidak tersedia.",
  "loot.sold.notHolder": "Hanya **<@{lootHolder}>** (pembawa loot) yang bisa menandai item terjual.",
  "loot.sold.allSold": "Semua item sudah ditandai terjual.",
  "loot.sold.prompt": "Item mana yang sudah terjual?",
  "loot.sold.placeholder": "Pilih item yang sudah terjual",
  "loot.sold.modalTitle": "Harga jual",
  "loot.sold.priceLabel": "Harga untuk \"{item}\"",
  "loot.sold.pricePlaceholder": "misal 500k, 1.2m, 750rb",
  "loot.sold.confirm": "✅ Ditandai terjual: **{item}** — {price}",

  // ---- gaji (payout) ----
  "loot.gaji.recordGone": "Data party ini sudah tidak tersedia.",
  "loot.gaji.notHolder": "Hanya **<@{lootHolder}>** (pembawa loot) yang bisa menandai gaji.",
  "loot.gaji.notAllSold": "Semua item harus terjual dulu sebelum gaji bisa ditandai.",
  "loot.gaji.allPaid": "Semua member sudah menerima gaji.",
  "loot.gaji.prompt": "Member mana yang sudah menerima gaji?",
  "loot.gaji.placeholder": "Pilih member yang sudah digaji",
  "loot.gaji.confirm": "✅ Gaji diberikan ke <@{userId}>",

  // ---- stamp ----
  "loot.stamp.recordGone": "Data loot untuk party ini sudah tidak tersedia.",
  "loot.stamp.notHolder": "Hanya **<@{lootHolder}>** (pembawa loot) yang bisa mengisi STAMP.",
  "loot.stamp.noRoster": "Tidak ada member di roster party ini.",
  "loot.stamp.prompt": "Isi STAMP untuk member mana?",
  "loot.stamp.placeholder": "Pilih member",
  "loot.stamp.modalTitle": "Isi STAMP",
  "loot.stamp.amountLabel": "Jumlah STAMP untuk {username}",
  "loot.stamp.amountPlaceholder": "misal 5",
  "loot.stamp.notANumber": "\"{raw}\" bukan angka yang valid. Coba lagi dengan angka saja, misal 5.",
  "loot.stamp.confirm": "🎟️ STAMP untuk <@{userId}> diset ke **{value}**.",

  // ---- delete loot ----
  "loot.delete.recordGone": "Data loot untuk party ini sudah tidak tersedia.",
  "loot.delete.adminOnly": "Hanya server admin yang bisa menghapus loot thread ini.",
  "loot.delete.confirmPrompt": "⚠️ Yakin mau hapus thread loot ini? Aksi ini tidak bisa dibatalkan.",
  "loot.delete.confirmYes": "Ya, hapus thread",
  "loot.delete.confirmNo": "Batal",
  "loot.delete.cancelled": "👍 Dibatalkan — thread tidak dihapus.",
  "loot.delete.deleting": "🗑️ Menghapus thread...",
  "loot.delete.failed": "Data loot sudah dihapus, tapi gagal menghapus thread — cek permission bot (Manage Threads).",

  // ---- change holder ----
  "loot.changeHolder.recordGone": "Data loot untuk party ini sudah tidak tersedia.",
  "loot.changeHolder.leaderOnly": "Hanya party leader yang bisa mengubah pembawa loot.",
  "loot.changeHolder.noRoster": "Tidak ada member di roster party ini.",
  "loot.changeHolder.prompt": "Siapa pembawa loot yang baru?",
  "loot.changeHolder.placeholder": "Pilih pembawa loot baru",
  "loot.changeHolder.currentTag": "⭐ {username} (saat ini)",
  "loot.changeHolder.confirm": "✅ Pembawa loot diubah ke <@{userId}>.",
};

module.exports = { en, id };
