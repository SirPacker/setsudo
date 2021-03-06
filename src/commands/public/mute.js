const Command = require("../../structures/command.js");

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: "mute",
      aliases: [],
      ltu: client.constants.perms.staff,
      selfhost: true
    });
  }

  /**
   * Entry point for the mute command
   * @param {Message} message The message that invoked the command
   * @returns {Message} The response to the command
   */
  async execute(message) {
    // match[] - msg content, ID, length:days?, length: hours?, length:minutes?, length:seconds?, reason 
    const match = /(?:mute)\s+(?:(?:<@!?)?(\d{17,20})>?)(?:\s+(?:(\d+)\s*d(?:ays)?)?\s*(?:(\d+)\s*h(?:ours|rs|r)?)?\s*(?:(\d+)\s*m(?:inutes|in)?)?\s*(?:(\d+)\s*s(?:econds|ec)?)?)(?:\s+([\w\W]+))/.exec(message.content);
    if (!match) return message.reply("Invalid Syntax: mute <user-id/mention> <#d#h#m#s> <reason>");

    const gSettings = await this.client.handlers.db.get("settings", message.guild.id);

    let detCat = gSettings["detentioncategory"];
    let muteRole = gSettings["mutedrole"];

    // Check for detention category, mute role, and supplied user
    if (!detCat || !message.guild.channels.get(detCat)) return message.reply("The detention category is either not set or no longer exists.");
    if (!muteRole || !message.guild.roles.get(muteRole)) return message.reply("The muted role is either not set or no longer exists");
    if (!match[1] || !message.guild.members.get(match[1])) return message.reply("Either a user was not supplied, or the user is no longer a member of the guild.");

    // Fetch affected user and corresponding GuildMember along with the mute role
    const muteUser = this.client.users.get(match[1]);
    const muteMember = await message.guild.members.fetch(match[1]);
    muteRole = message.guild.roles.get(muteRole);

    // Prevent a user from being muted twice
    if (await this.client.handlers.db.has("detention", `${message.guild.id}-${muteUser.id}`)) 
      return message.reply(`${muteUser.tag} is already muted`);

    detCat = message.guild.channels.get(detCat);

    // Add mute role to affected user
    await muteMember.roles.add(muteRole);

    // Calculate mute length and string
    const muteLengthMS =
      ((60 * 60 * 24 * (match[2] ? Number(match[2]) : 0)) +
        (60 * 60 * (match[3] ? Number(match[3]) : 0)) +
        (60 * (match[4] ? Number(match[4]) : 0)) +
        (match[5] ? Number(match[5]) : 0)) * 1000;
    const muteLengthStr = `${match[2] ? `${match[2]}d` : ""}${match[3] ? `${match[3]}h` : ""}${match[4] ? `${match[4]}m` : ""}${match[5] ? `${match[5]}s` : ""}`;
    const endTime = Date.now() + muteLengthMS;

    // Create mute channel
    const muteChan = await message.guild.channels.create(
      `mute-${muteUser.id}`,
      {
        parent: detCat,
        reason: `${message.author.tag} muted ${muteUser.tag}`,
        type: "text"
      }
    );

    // Make muted user able to see the mute channel
    muteChan.updateOverwrite(muteUser.id, {
      VIEW_CHANNEL: true
    });

    // DM affected user that they were muted if possible
    await muteUser.send({ embed: this.client.constants.embedTemplates.dm(message, `Muted (${muteLengthStr})`, match[6]) })
      .catch(() => message.reply('Unable to DM user.'));

    // Check if the guild has a logs channel
    if (gSettings["modlogschannel"] && message.guild.channels.get(gSettings["modlogschannel"])) {
      message.guild.channels
        .get(gSettings["modlogschannel"])
        .send({ embed: this.client.constants.embedTemplates.logs(message, muteUser, `Mute (${muteLengthStr})`, match[6]) });
    }

    // Store mute in corresponding DBs
    await this.client.handlers.db.insert("tempmodactions", {
      "id": `${message.guild.id}-${muteUser.id}`,
      "data": { action: "mute", endTime }
    });

    await this.client.handlers.db.insert("detention", {
      "id": `${message.guild.id}-${muteUser.id}`,
      "data": muteChan.id
    });

    // Add mute to the user's mod notes DB entry
    this.client.handlers.modNotes.addAction(message, muteUser, message.author, `Mute (${muteLengthStr})`, match[6]);

    return message.reply(`${muteUser.tag} has been muted.`);
  }
};