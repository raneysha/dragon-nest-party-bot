# Dragon Nest Party Bot

A Discord bot for organizing Dragon Nest parties and raids. Post a listing
with role slots, let people join with one click, track loot after the run,
and configure defaults per server — all through slash commands and buttons,
no typing required to sign up.

## Features

### Party organizing
- `/party create` — post a party listing with activity name, time, note,
  Nest type, and how many of each role you need. Any role left blank uses
  this server's default composition (see `/config` below).
- Click-to-join buttons for every role: **Paladin, Healer, Swordmaster,
  Mercenary, Sorceress, Acrobat, Flexible (DPS)**. Clicking a different
  role moves you there.
- Several roles open a class picker (a dropdown) after you click the role
  button, so you can specify exactly which class you're bringing (e.g.
  Paladin → Guardian/Destroyer/Crusader). The roster shows your class next
  to your name.
- **Ping** — tag every current party member with a custom message you type.
- **Leave** — drop your own slot.
- **Kick** — party leader (or a server admin) can remove another member.
- **Finish** — wraps up a completed run (see below).
- **Disband** — cancel the listing outright (leader or admin).
- Roles auto-disable once full; the embed turns green when the party is
  completely filled.
- `/party list` — see all active parties in the current channel.
- `/party recall` — repost a party's listing if it's gotten buried in chat
  (deletes the old message, keeps the same roster).

### Finishing a run & loot tracking
Clicking **Finish** (leader or admin only) walks through:
1. Pick who's holding the loot
2. Fill in what dropped and the clear date
3. The bot creates a thread named `[Party name] [Date] [Loot holder]`,
   adds every party member to it, and posts a loot recap embed —
   broken down by role, with each member's class shown
4. You're asked whether to also disband the original party listing, or
   keep it open for another run

Inside the loot thread, the recap embed has its own buttons:
- **SOLD** — mark an item sold and log the price
- **STAMP** — record a member's STAMP count
- **GAJI** — calculate each member's payout share (splits evenly across
  the actual number of party members, not a fixed number)
- **Ubah Pembawa Loot** — change who's holding the loot after the fact
- **Delete** *(server admins only)* — deletes the thread and its saved
  record, after a confirmation prompt

### Character registry
- `/character add` — register one of your characters (in-game name + class,
  picked from a dropdown of every class in the game)
- `/character list` — view your own characters, or someone else's by
  tagging them
- `/character search` — pick a class and see which players in this server
  have a character of that class (with their in-game names)
- `/character remove` — remove a character you registered

### Per-server configuration
`/config` (admin-only):
- `set-loot-channel` / `clear-loot-channel` — choose a specific channel
  (text or forum) where Finish always creates its loot thread, instead of
  wherever the party happened to be posted
- `set-default-party` / `clear-default-party` — set this server's own
  default party composition. Leave any role blank when setting it and that
  role falls back to the bot's built-in default (1 of each core role,
  2 Flexible — 8 total)
- `view` — see the server's current settings

## Data persistence

Everything that should survive a bot restart is saved to JSON files in a
`data/` folder, created automatically the first time it's needed:
- `data/characters.json` — registered characters
- `data/loot.json` — loot recap records (items, roster, sold/STAMP status)
- `data/guildConfig.json` — per-server settings from `/config`

Active party listings themselves are **not** persisted — they're meant to
be short-lived for a single session, so a restart clears them (finished
runs are safe either way, since Finish already moves everything into a
saved loot record before the party listing is cleared).

## Setup

### 1. Create a Discord Application & Bot
1. Go to <https://discord.com/developers/applications> and click **New Application**.
2. Go to the **Bot** tab, click **Reset Token** to get your bot token (save it — you won't see it again).
3. No privileged gateway intents are needed — this bot only uses slash commands, buttons, and threads.
4. Go to **OAuth2 → URL Generator**, check scopes `bot` and `applications.commands`, and under Bot Permissions check `Send Messages`, `Embed Links`, `Use Slash Commands`, `Create Public Threads`, `Send Messages in Threads`, and `Manage Threads` (needed for the loot thread Delete button). Copy the generated URL and open it to invite the bot to your server.

### 2. Configure the project
```
cp .env.example .env
```
Fill in `.env`:
- `DISCORD_TOKEN` — the bot token from step 1
- `CLIENT_ID` — your application's **Application ID** (General Information tab)
- `GUILD_ID` — (optional but recommended while testing) your Discord server's ID, so commands register instantly instead of taking up to an hour. Right-click your server icon → Copy Server ID (needs Developer Mode on in Discord settings). Leave blank to register commands globally across every server the bot is in.

### 3. Install & run
```
npm install
npm run deploy   # registers all slash commands with Discord
npm start        # starts the bot
```
If it worked, you'll see `✅ Logged in as YourBot#1234` in the console.

## Usage

```
/party create activity: Molten Core Raid paladins: 2 healers: 2 flexible: 5 time: Tonight 8pm EST note: Min item level 400
```
Any role left out uses this server's default (or the bot's built-in default if none is set). This posts an embed with join buttons — anyone can click a role to sign up, or pick a specific class if that role has one.

When the run wraps up, the leader (or an admin) clicks **Finish** to log loot and spin up a recap thread automatically.

## Troubleshooting

- **Seeing duplicate slash commands?** This usually means commands got registered both globally and to a specific `GUILD_ID` server at different points. Clear the guild-specific ones and redeploy with `GUILD_ID` blank in `.env` for global-only commands.
- **"Missing Access" or permission errors on Finish/Kick/thread creation?** Double-check the bot's role has the right permissions in that specific channel — Discord channel-level overrides can restrict a bot even if it has the permission server-wide.

## Notes & next steps

- Want auto-expiring parties, DM notifications when a party fills, or more granular per-role permissions? Those are natural next additions.