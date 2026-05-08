import { SlashCommandBuilder, version, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
    .setName("thongke")
    .setDescription("Xem thống kê bot"),

  async execute(interaction) {
    try {
      await InteractionHelper.safeDefer(interaction);
      
      const totalGuilds = interaction.client.guilds.cache.size;
      const totalMembers = interaction.client.guilds.cache.reduce(
        (acc, guild) => acc + guild.memberCount,
        0,
      );
      const nodeVersion = process.version;

      const embed = createEmbed({ title: "📊 Thống kê Hệ thống", description: "Số liệu hiệu suất thời gian thực." }).addFields(
        { name: "Máy chủ", value: `${totalGuilds}`, inline: true },
        { name: "Người dùng", value: `${totalMembers}`, inline: true },
        { name: "Node.js", value: `${nodeVersion}`, inline: true },
        { name: "Discord.js", value: `v${version}`, inline: true },
        {
          name: "Sử dụng Bộ nhớ",
          value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
          inline: true,
        },
      );

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error('Stats command error:', error);
      return InteractionHelper.safeEditReply(interaction, {
        embeds: [createEmbed({ title: 'Lỗi Hệ thống', description: 'Không thể lấy thống kê hệ thống.', color: 'error' })],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};




