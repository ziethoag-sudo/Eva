import { PermissionsBitField, ChannelType } from 'discord.js';
import { errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../../services/guildConfig.js';
import { logEvent } from '../../../utils/moderation.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';

export default {
    async execute(interaction, config, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Quyền bị từ chối', 'Bạn cần quyền **Quản trị viên** để thay đổi kênh nhật ký.')],
            });
        }

        if (!client.db) {
            return InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Lỗi Cơ Sở Dữ Liệu', 'Cơ sở dữ liệu chưa được khởi tạo.')],
            });
        }

        const guildId = interaction.guildId;
        const currentConfig = await getGuildConfig(client, guildId);

        const logChannel = interaction.options.getChannel('channel');
        const disableLogging = interaction.options.getBoolean('disable');

        try {
            if (disableLogging) {
                currentConfig.logChannelId = null;
                currentConfig.enableLogging = false;
                currentConfig.logging = {
                    ...(currentConfig.logging || {}),
                    enabled: false,
                    channelId: null,
                };
                await setGuildConfig(client, guildId, currentConfig);
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed('Ghi Nhật Ký Đã Tắt 🚫', 'Ghi nhật ký kiểm tra đã được tắt cho máy chủ này.')],
                });
            }

            if (logChannel) {
                const perms = logChannel.permissionsFor(interaction.guild.members.me);
                if (!perms.has(PermissionsBitField.Flags.SendMessages) || !perms.has(PermissionsBitField.Flags.EmbedLinks)) {
                    return InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed('Lỗi Quyền Bot', `Tôi cần quyền **Gửi Tin Nhắn** và **Liên Kết Nhúng** trong ${logChannel}.`)],
                    });
                }

                currentConfig.logChannelId = logChannel.id;
                currentConfig.enableLogging = true;
                currentConfig.logging = {
                    ...(currentConfig.logging || {}),
                    enabled: true,
                    channelId: logChannel.id,
                };
                await setGuildConfig(client, guildId, currentConfig);

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed('Kênh Nhật Ký Đã Đặt 📝', `Nhật ký kiểm tra sẽ được gửi đến ${logChannel}.`)],
                });

                await logEvent({
                    client,
                    guild: interaction.guild,
                    event: {
                        action: 'Log Channel Activated',
                        target: logChannel.toString(),
                        executor: `${interaction.user.tag} (${interaction.user.id})`,
                        reason: `Logging channel set by ${interaction.user}`,
                        metadata: { channelId: logChannel.id, moderatorId: interaction.user.id, loggingEnabled: true },
                    },
                });
                return;
            }

            return InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Không Cung Cấp Tùy Chọn', 'Cung cấp một trong: `channel` hoặc `disable: True`.\n\n> Kênh bản ghi và nhật ký ticket được quản lý qua `/ticket setup` hoặc `/ticket dashboard`.')],
            });
        } catch (error) {
            logger.error('logging setchannel error:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Lỗi Cấu Hình', 'Không thể lưu cấu hình.')],
            });
        }
    },
};
