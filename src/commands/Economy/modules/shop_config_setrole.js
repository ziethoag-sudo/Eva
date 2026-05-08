import { PermissionsBitField } from 'discord.js';
import { errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../../services/guildConfig.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';

export default {
    async execute(interaction, config, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Quyền bị từ chối', 'Bạn cần quyền **Quản lý máy chủ** để đặt vai trò premium.')],
                ephemeral: true,
            });
        }

        const role = interaction.options.getRole('role');
        const guildId = interaction.guildId;

        try {
            const currentConfig = await getGuildConfig(client, guildId);
            currentConfig.premiumRoleId = role.id;
            await setGuildConfig(client, guildId, currentConfig);

            return InteractionHelper.safeReply(interaction, {
                embeds: [successEmbed('✅ Vai trò Premium đã đặt', `**Vai trò Cửa hàng Premium** đã được đặt thành ${role.toString()}. Thành viên mua vật phẩm Vai trò Premium sẽ được cấp vai trò này.`)],
                ephemeral: true,
            });
        } catch (error) {
            logger.error('shop_config_setrole error:', error);
            return InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Lỗi hệ thống', 'Không thể lưu cấu hình máy chủ.')],
                ephemeral: true,
            });
        }
    },
};
