const Command = require("../../structures/command.js");

module.exports = class extends Command {
  constructor(client) {
    super(client, {
      name: "unban",
      aliases: [],
      ltu: client.constants.perms.staff,
      selfhost: true
    });
  }
  /**
   * Entry point for the unban command
   * @param {Message} message The message that invoked the command
   * @returns {Message} The response to the command
   */
  async execute(message) {
    // addAction(message, user, mod, action, reason)
    const match = /(?:unban)\s+(?:(?:<@!?)?(\d{17,20})>?)(?:\s+([\w\W]+))/.exec(message.content);
    if (!match) return message.reply("Invalid Syntax: unban <user-id/mention> <msg>");

    // Fetch affected user
    const user = await this.client.users.fetch(match[1]);
    
    await message.guild.members.unban(user.id);

    // Check if guild has logs channel
    const gSettings = await this.client.handlers.db.get("settings", message.guild.id);
    if (gSettings["modlogschannel"] && message.guild.channels.get(gSettings["modlogschannel"])) {
      message.guild.channels
        .get(gSettings["modlogschannel"])
        .send({ embed: this.client.constants.embedTemplates.logs(message, user, "Unban", match[2]) });
    }

    // Append unban to user's mod notes DB entry
    this.client.handlers.modNotes.addAction(message, user, message.author, "Unban", match[2]);
    
    return message.reply(`${user.tag} unbanned.`);
  }
};