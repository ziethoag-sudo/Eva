import { PermissionsBitField, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../../services/guildConfig.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';

export default {
    async execute(interaction, config, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Không có quyền', 'Bạn cần quyền **Quản lý máy chủ** để cấu hình kênh sinh nhật.')],
                flags: MessageFlags.Ephemeral,
            });
        }

        try {
            const channel = interaction.options.getChannel('kenh');
            const guildId = interaction.guildId;
            const guildConfig = await getGuildConfig(client, guildId);

            if (channel) {
                guildConfig.birthdayChannelId = channel.id;
                await setGuildConfig(client, guildId, guildConfig);
                return InteractionHelper.safeReply(interaction, {
                    embeds: [successEmbed('🎂 Thông báo sinh nhật đã bật', `Thông báo sinh nhật sẽ được đăng tại ${channel}.`)],
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                guildConfig.birthdayChannelId = null;
                await setGuildConfig(client, guildId, guildConfig);
                return InteractionHelper.safeReply(interaction, {
                    embeds: [successEmbed('🎂 Thông báo sinh nhật đã tắt', 'Không có kênh được cung cấp — thông báo sinh nhật đã bị tắt.')],
                    flags: MessageFlags.Ephemeral,
                });
            }
        } catch (error) {
            logger.error('birthday_setchannel error:', error);
            return InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Lỗi cấu hình', 'Không thể lưu cấu hình kênh sinh nhật.')],
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
