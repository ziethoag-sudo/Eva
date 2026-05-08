




import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { checkUserPermissions } from '../../utils/permissionGuard.js';
import { removeLevels, getUserLevelData, getLevelingConfig } from '../../services/leveling.js';
import { createEmbed } from '../../utils/embeds.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
  data: new SlashCommandBuilder()
    .setName('levelremove')
    .setDescription('Xóa cấp từ người dùng')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Người dùng để xóa cấp')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('levels')
        .setDescription('Số cấp để xóa')
        .setRequired(true)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  category: 'Leveling',

  





  async execute(interaction, config, client) {
    try {
      await InteractionHelper.safeDefer(interaction);

      
      const hasPermission = await checkUserPermissions(
        interaction,
        PermissionFlagsBits.ManageGuild,
        'Bạn cần quyền ManageGuild để sử dụng lệnh này.'
      );
      if (!hasPermission) return;

      const levelingConfig = await getLevelingConfig(client, interaction.guildId);
      if (!levelingConfig?.enabled) {
        await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            new EmbedBuilder()
              .setColor('#f1c40f')
              .setDescription('Hệ thống cấp độ hiện đang bị tắt trên máy chủ này.')
          ],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const targetUser = interaction.options.getUser('user');
      const levelsToRemove = interaction.options.getInteger('levels');

      
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        throw new TitanBotError(
          `Người dùng ${targetUser.id} không tìm thấy trong máy chủ này`,
          ErrorTypes.USER_INPUT,
          'Người dùng được chỉ định không có trong máy chủ này.'
        );
      }

      
      const userData = await getUserLevelData(client, interaction.guildId, targetUser.id);
      if (userData.level === 0) {
        throw new TitanBotError(
          `Người dùng ${targetUser.id} đã ở cấp tối thiểu`,
          ErrorTypes.VALIDATION,
          `${targetUser.tag} đã ở cấp 0 và không thể xóa cấp.`
        );
      }

      
      const updatedData = await removeLevels(client, interaction.guildId, targetUser.id, levelsToRemove);

      await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          createEmbed({
            title: '✅ Đã Xóa Cấp',
            description: `Đã xóa thành công ${levelsToRemove} cấp từ ${targetUser.tag}.\n**Cấp Mới:** ${updatedData.level}`,
            color: 'success'
          })
        ]
      });

      logger.info(
        `[ADMIN] User ${interaction.user.tag} removed ${levelsToRemove} levels from ${targetUser.tag} in guild ${interaction.guildId}`
      );
    } catch (error) {
      logger.error('LevelRemove command error:', error);
      await handleInteractionError(interaction, error, {
        type: 'command',
        commandName: 'levelremove'
      });
    }
  }
};


