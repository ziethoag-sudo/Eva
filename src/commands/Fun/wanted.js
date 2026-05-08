import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { sanitizeInput } from '../../utils/sanitization.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
    .setName("wanted")
    .setDescription("Tạo một poster TRUY NÃ cho một người dùng.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Người dùng bị truy nã.")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("crime")
        .setDescription("Tội mà họ đã phạm.")
        .setRequired(false)
        .setMaxLength(100),
    ),
  category: 'Fun',

  async execute(interaction, config, client) {
    try {
      await InteractionHelper.safeDefer(interaction);

      const targetUser = interaction.options.getUser("user");
      const crimeRaw = interaction.options.getString("crime");

      
      let crime = "Dễ thương quá mức cho máy chủ này.";
      if (crimeRaw) {
        const sanitizedCrime = sanitizeInput(crimeRaw.trim(), 100);
        if (sanitizedCrime.length > 0) {
          crime = sanitizedCrime;
        }
      }

      
      if (!targetUser) {
        throw new TitanBotError(
          'Không tìm thấy người dùng cho lệnh wanted',
          ErrorTypes.USER_INPUT,
          'Không thể tìm thấy người dùng đã chỉ định.'
        );
      }

      const bountyAmount = Math.floor(
        Math.random() * (100000000 - 1000000) + 1000000,
      );
      const bounty = `$${bountyAmount.toLocaleString()} USD`;

      const embed = createEmbed({
        color: 'primary',
        title: '💥 GIẢI THƯỞNG LỚN: TRUY NÃ! 💥',
        description: `**TỘI PHẠM:** ${targetUser.tag}\n**TỘI DANH:** ${crime}`,
        fields: [
          {
            name: "CHẾT HOẶC SỐNG",
            value: `**GIẢI THƯỞNG:** ${bounty}`,
            inline: false,
          },
        ],
        image: {
          url: targetUser.displayAvatarURL({ size: 1024, extension: 'png' }),
        },
        footer: {
          text: `Lần cuối xuất hiện tại ${interaction.guild.name}`,
        },
      });

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      logger.debug(`Wanted command executed by user ${interaction.user.id} for ${targetUser.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Wanted command error:', error);
      await handleInteractionError(interaction, error, {
        commandName: 'wanted',
        source: 'wanted_command'
      });
    }
  },
};



