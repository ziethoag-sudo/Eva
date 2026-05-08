import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { sanitizeInput } from '../../utils/sanitization.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
function stringToHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export default {
    data: new SlashCommandBuilder()
    .setName("ship")
    .setDescription("Tính điểm tương hợp giữa hai người.")
    .addStringOption((option) =>
      option
        .setName("name1")
        .setDescription("Tên hoặc người đầu tiên.")
        .setRequired(true)
        .setMaxLength(100),
    )
    .addStringOption((option) =>
      option
        .setName("name2")
        .setDescription("Tên hoặc người thứ hai.")
        .setRequired(true)
        .setMaxLength(100),
    ),
  category: 'Fun',

  async execute(interaction, config, client) {
    try {
      await InteractionHelper.safeDefer(interaction);

      const name1Raw = interaction.options.getString("name1");
      const name2Raw = interaction.options.getString("name2");

      
      if (!name1Raw || name1Raw.trim().length === 0 || !name2Raw || name2Raw.trim().length === 0) {
        throw new TitanBotError(
          'Không có tên hợp lệ cho lệnh ship',
          ErrorTypes.USER_INPUT,
          'Vui lòng cung cấp tên hợp lệ cho cả hai người!'
        );
      }

      
      const name1 = sanitizeInput(name1Raw.trim(), 100);
      const name2 = sanitizeInput(name2Raw.trim(), 100);

      
      if (name1.toLowerCase() === name2.toLowerCase()) {
        const embed = warningEmbed(
          "💖 Điểm Ship",
          `**${name1}** không thể ship với chính họ! Vui lòng chọn hai người khác nhau.`
        );
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      const sortedNames = [name1, name2].sort();
      const combination = sortedNames.join("-").toLowerCase();
      const score = stringToHash(combination) % 101;

      let description;
      if (score === 100) {
        description = "Tri kỉ! Định mệnh rồi, họ sinh ra để dành cho nhau!";
      } else if (score >= 80) {
        description = "Một cặp hoàn hảo! Chuẩn bị tiếng chuông cưới!";
      } else if (score >= 60) {
        description = "Hoá học ổn. Rất đáng để khám phá!";
      } else if (score >= 40) {
        description = "Chỉ là bạn bè. Có lẽ theo thời gian?";
      } else if (score >= 20) {
        description = "Còn vật lộn. Họ có thể cần khoảng cách.";
      } else {
        description = "Hoàn toàn không hợp. Chạy ngay đi!";
      }

      const progressBar =
        "█".repeat(Math.floor(score / 10)) +
        "░".repeat(10 - Math.floor(score / 10));

      const embed = successEmbed(
        `💖 Điểm Ship: ${name1} vs ${name2}`,
        `Tương hợp: **${score}%**\n\n\`${progressBar}\`\n\n*${description}*`,
      );

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      logger.debug(`Ship command executed by user ${interaction.user.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Ship command error:', error);
      await handleInteractionError(interaction, error, {
        commandName: 'ship',
        source: 'ship_command'
      });
    }
  },
};




