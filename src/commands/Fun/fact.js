import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
const facts = [
  "Bạn có biết? Pháo là Owner lười nhất server.",
  "bạn có biết? Số bot còn nhiều hơn Member.",
  "Fact: Gok ngầu nhất Server.",
  "Bạn có biết? Bot này được tạo bởi Gok chỉ trong vòng 1 tuần.",
  "Bạn có biết? Bot này có trên 10 Server khi mới tạo ra.",
  "Fact: trả nợ cho tao PHÁO!!!!",
];

export default {
    data: new SlashCommandBuilder()
    .setName("fact")
    .setDescription("Chia sẻ một sự thật thú vị ngẫu nhiên."),
  category: 'Fun',

  async execute(interaction, config, client) {
    try {
      const randomFact = facts[Math.floor(Math.random() * facts.length)];

      const embed = successEmbed("🧠 Bạn có biết?", `💡 **${randomFact}**`);

      await InteractionHelper.safeReply(interaction, { embeds: [embed] });
      logger.debug(`Fact command executed by user ${interaction.user.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Fact command error:', error);
      await handleInteractionError(interaction, error, {
        commandName: 'fact',
        source: 'fact_command'
      });
    }
  },
};




