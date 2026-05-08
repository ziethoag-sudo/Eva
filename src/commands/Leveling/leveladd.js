




import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { checkUserPermissions } from '../../utils/permissionGuard.js';
import { addLevels, getLevelingConfig } from '../../services/leveling.js';
import { createEmbed } from '../../utils/embeds.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
  data: new SlashCommandBuilder()
    .setName('leveladd')
    .setDescription('Thêm cấp cho người dùng')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Người dùng để thêm cấp')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('levels')
        .setDescription('Số cấp để thêm')
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
      const levelsToAdd = interaction.options.getInteger('levels');

      
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        throw new TitanBotError(
          `Người dùng ${targetUser.id} không tìm thấy trong máy chủ này`,
          ErrorTypes.USER_INPUT,
          'Người dùng được chỉ định không có trong máy chủ này.'
        );
      }

      
      const userData = await addLevels(client, interaction.guildId, targetUser.id, levelsToAdd);

      await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          createEmbed({
            title: '✅ Đã Thêm Cấp',
            description: `Đã thêm thành công ${levelsToAdd} cấp cho ${targetUser.tag}.\n**Cấp Mới:** ${userData.level}`,
            color: 'success'
          })
        ]
      });

      logger.info(
        `[ADMIN] User ${interaction.user.tag} added ${levelsToAdd} levels to ${targetUser.tag} in guild ${interaction.guildId}`
      );
    } catch (error) {
      logger.error('LevelAdd command error:', error);
      await handleInteractionError(interaction, error, {
        type: 'command',
        commandName: 'leveladd'
      });
    }
  }
};


