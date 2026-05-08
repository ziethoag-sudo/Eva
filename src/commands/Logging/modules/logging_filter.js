import { PermissionsBitField } from 'discord.js';
import { errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../../services/guildConfig.js';
import { logEvent } from '../../../utils/moderation.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';

export default {
    async execute(interaction, config, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Quyền bị từ chối', 'Bạn cần quyền **Quản trị viên** để quản lý bộ lọc nhật ký.')],
            });
        }

        if (!client.db) {
            return InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Lỗi Cơ Sở Dữ Liệu', 'Cơ sở dữ liệu chưa được khởi tạo.')],
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const type = interaction.options.getString('type');
        const entityId = interaction.options.getString('id');
        const guildId = interaction.guildId;

        const currentConfig = await getGuildConfig(client, guildId);
        if (!currentConfig.logIgnore) {
            currentConfig.logIgnore = { users: [], channels: [] };
        }

        let targetArray;
        let entityType;
        let entityName;

        if (type === 'user') {
            targetArray = currentConfig.logIgnore.users;
            entityType = 'Người dùng';
            const member = await interaction.guild.members.fetch(entityId).catch(() => null);
            entityName = member ? member.user.tag : `ID: ${entityId}`;
        } else if (type === 'channel') {
            targetArray = currentConfig.logIgnore.channels;
            entityType = 'Kênh';
            const channel = interaction.guild.channels.cache.get(entityId);
            entityName = channel ? `#${channel.name}` : `ID: ${entityId}`;
        } else {
            return InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Loại Không Hợp Lệ', "Chọn `user` hoặc `channel`.")],
            });
        }

        let successMessage;

        if (subcommand === 'add') {
            if (targetArray.includes(entityId)) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed('Đã Được Lọc', `${entityType} **${entityName}** đã có trong danh sách bỏ qua.`)],
                });
            }
            targetArray.push(entityId);
            successMessage = `${entityType} **${entityName}** đã được thêm vào danh sách bỏ qua nhật ký. Sự kiện từ họ sẽ không được ghi nhật ký.`;
        } else if (subcommand === 'remove') {
            const index = targetArray.indexOf(entityId);
            if (index === -1) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed('Không Được Lọc', `${entityType} **${entityName}** không có trong danh sách bỏ qua.`)],
                });
            }
            targetArray.splice(index, 1);
            successMessage = `${entityType} **${entityName}** đã được xóa khỏi danh sách bỏ qua nhật ký. Sự kiện sẽ được ghi nhật ký.`;
        } else {
            return;
        }

        try {
            await setGuildConfig(client, guildId, currentConfig);

            await logEvent({
                client,
                guild: interaction.guild,
                event: {
                    action: 'Log Filter Updated',
                    target: `Filter ${subcommand}`,
                    executor: `${interaction.user.tag} (${interaction.user.id})`,
                    metadata: { entityType, loggingEnabled: currentConfig.enableLogging },
                },
            });

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed('Bộ Lọc Đã Cập Nhật', successMessage)],
            });
        } catch (error) {
            logger.error('logging filter error:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Lỗi Cơ Sở Dữ Liệu', 'Không thể lưu thay đổi bộ lọc.')],
            });
        }
    },
};
