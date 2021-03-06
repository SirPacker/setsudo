const Command = require("../../structures/command.js");

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: "tempban",
      aliases: [],
      ltu: client.constants.perms.staff,
      selfhost: true
    });
  }

  /**
   * Entry point for tempban command
   * @param {Message} message The message that invoked the command
   * @returns {Message} The response to the command
   */
  async execute(message) {
    // addAction(message, user, mod, action, reason)
    const match = /(?:tempban)\s+(?:(?:<@!?)?(\d{17,20})>?)(?:\s+(\d+))(?:\s+([\w\W]+))/.exec(message.content);
    if (!match) return message.reply("Invalid Syntax: tempban <user-id/mention> <time-in-days> <reason>");

    // Fetch affected user and corresponding GuildMember instance
    const user = await this.client.users.fetch(match[1]);
    const member = await message.guild.members.fetch(match[1]);

    // Calculate end time for tempban
    const endTime = Date.now() + (Number(match[2]) * 24 * 60 * 60 * 1000);

    // DM affected user that they were tempbanned if possible
    await user.send({ embed: this.client.constants.embedTemplates.dm(message, `Tempbanned (${match[2]} days)`, match[3]) })
      .catch(() => message.reply("Unable to DM user."));

    await member.ban();

    // Check if guild has logs channel
    const gSettings = await this.client.handlers.db.get("settings", message.guild.id);
    if (gSettings["modlogschannel"] && message.guild.channels.get(gSettings["modlogschannel"])) {
      message.guild.channels
        .get(gSettings["modlogschannel"])
        .send({ embed: this.client.constants.embedTemplates.logs(message, user, `Tempban (${match[2]} days)`, match[3]) });
    }

    // Store tempban information in DB
    await this.client.handlers.db.insert("tempmodactions", {
      "id": `${message.guild.id}-${user.id}`,
      "data": { action: "tempban", endTime }
    });

    // Append tempban to user's mod notes DB entry
    this.client.handlers.modNotes.addAction(message, user, message.author, `Tempban (${match[2]}d)`, match[3]);
    
    return message.reply(`${user.tag} tempbanned for ${match[2]} days.`);
  }
};