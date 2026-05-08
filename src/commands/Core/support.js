import { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
const SUPPORT_SERVER_URL = "https://discord.gg/bVzhwtgTc";
export default {
    data: new SlashCommandBuilder()
    .setName("hotro")
    .setDescription("Nhận liên kết đến máy chủ hỗ trợ"),

  async execute(interaction) {
    try {
      const supportButton = new ButtonBuilder()
        .setLabel("Tham gia Máy chủ Hỗ trợ")
        .setStyle(ButtonStyle.Link)
        .setURL(SUPPORT_SERVER_URL);

      const actionRow = new ActionRowBuilder().addComponents(supportButton);

      await InteractionHelper.safeReply(interaction, {
        embeds: [
          createEmbed({ title: "🚑 Cần Trợ giúp?", description: "Tham gia máy chủ hỗ trợ chính thức của chúng tôi để được trợ giúp, báo lỗi hoặc đề xuất tính năng. Nếu bạn đang tùy chỉnh bot này, hãy nhớ thay đổi liên kết trong mã!" }),
        ],
        components: [actionRow],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('Support command error:', error);
      
      try {
        return await InteractionHelper.safeReply(interaction, {
          embeds: [createEmbed({ title: 'Lỗi Hệ thống', description: 'Không thể hiển thị thông tin hỗ trợ.', color: 'error' })],
          flags: MessageFlags.Ephemeral,
        });
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  },
};





