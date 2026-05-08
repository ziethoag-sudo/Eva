import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { sanitizeInput } from '../../utils/sanitization.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
    .setName("reverse")
    .setDescription("Viết ngược văn bản của bạn.")
    .addStringOption((option) =>
      option
        .setName("text")
        .setDescription("Văn bản để đảo.")
        .setRequired(true)
        .setMaxLength(1000),
    ),
  category: 'Fun',

  async execute(interaction, config, client) {
    try {
      const originalText = interaction.options.getString("text");
      
      
      if (!originalText || originalText.trim().length === 0) {
        throw new TitanBotError(
          'Không có văn bản hợp lệ cho lệnh reverse',
          ErrorTypes.USER_INPUT,
          'Vui lòng cung cấp văn bản để đảo!'
        );
      }

      
      const sanitizedText = sanitizeInput(originalText, 1000);
      const reversedText = sanitizedText.split("").reverse().join("");

      const embed = successEmbed(
        "Văn bản ngược",
        `Bản gốc: **${sanitizedText}**\nĐã đảo: **${reversedText}**`,
      );

      await InteractionHelper.safeReply(interaction, { embeds: [embed] });
      logger.debug(`Reverse command executed by user ${interaction.user.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Reverse command error:', error);
      await handleInteractionError(interaction, error, {
        commandName: 'reverse',
        source: 'reverse_command'
      });
    }
  },
};


