import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getColor } from '../../config/bot.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { getLoggingStatus } from '../../services/loggingService.js';
import { getLevelingConfig } from '../../services/leveling.js';
import { getConfiguration as getJoinToCreateConfiguration } from '../../services/joinToCreateService.js';
import { getWelcomeConfig, getApplicationSettings } from '../../utils/database.js';
import { errorEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

function pill(enabled) {
    return enabled ? '✅ Bật' : '❌ Tắt';
}

async function formatChannelMention(guild, id) {
    if (!id) return '`Chưa cấu hình`';
    const channel = guild.channels.cache.get(id) ?? await guild.channels.fetch(id).catch(() => null);
    return channel ? channel.toString() : `⚠️ Thiếu (${id})`;
}

function formatRoleMention(guild, id) {
    if (!id) return '`Chưa cấu hình`';
    const role = guild.roles.cache.get(id);
    return role ? role.toString() : `⚠️ Thiếu (${id})`;
}

export default {
    data: new SlashCommandBuilder()
        .setName('Tổng quan')
        .setDescription('Ảnh chụp nhanh chỉ đọc của tất cả trạng thái hệ thống máy chủ.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const [guildConfig, loggingStatus, levelingConfig, welcomeConfig, applicationConfig, joinToCreateConfig] =
                await Promise.all([
                    getGuildConfig(client, interaction.guildId),
                    getLoggingStatus(client, interaction.guildId),
                    getLevelingConfig(client, interaction.guildId),
                    getWelcomeConfig(client, interaction.guildId),
                    getApplicationSettings(client, interaction.guildId),
                    getJoinToCreateConfiguration(client, interaction.guildId),
                ]);

            const verificationEnabled = Boolean(guildConfig.verification?.enabled);
            const autoVerifyEnabled = Boolean(guildConfig.verification?.autoVerify?.enabled);
            const autoRoleId = guildConfig.autoRole || welcomeConfig?.roleIds?.[0];

            // ── Channels ──────────────────────────────────────────────────────
            const [auditChannel, lifecycleChannel, transcriptChannel, reportChannel, birthdayChannel] =
                await Promise.all([
                    formatChannelMention(interaction.guild, loggingStatus.channelId || guildConfig.logging?.channelId || guildConfig.logChannelId),
                    formatChannelMention(interaction.guild, guildConfig.ticketLogsChannelId),
                    formatChannelMention(interaction.guild, guildConfig.ticketTranscriptChannelId),
                    formatChannelMention(interaction.guild, guildConfig.reportChannelId),
                    formatChannelMention(interaction.guild, guildConfig.birthdayChannelId),
                ]);

            const embed = new EmbedBuilder()
                .setTitle('🖥️ Tổng quan hệ thống')
                .setDescription(`Ảnh chụp nhanh chỉ đọc cho **${interaction.guild.name}**. Sử dụng bảng điều khiển của lệnh liên quan để thực hiện thay đổi.`)
                .setColor(getColor('primary'))
                .addFields(
                    // ── Core systems ──
                    {
                        name: '⚙️ Core Systems',
                        value: [
                           `🧾 **Ghi nhật ký Kiểm tra** — ${pill(Boolean(loggingStatus.enabled))}`,
                            `📈 **Cấp độ** — ${pill(Boolean(levelingConfig?.enabled))}`,
                            `👋 **Chào mừng** — ${pill(Boolean(welcomeConfig?.enabled))}`,
                            `👋 **Tạm biệt** — ${pill(Boolean(welcomeConfig?.goodbyeEnabled))}`,
                            `🎂 **Sinh nhật** — ${pill(Boolean(guildConfig.birthdayChannelId))}`,
                            `📋 **Ứng dụng** — ${pill(Boolean(applicationConfig?.enabled))}`,
                            `✅ **Xác minh** — ${pill(verificationEnabled)}`,
                            `🤖 **Tự động Xác minh** — ${pill(autoVerifyEnabled)}`,
                            `🎧 **Tham gia để Tạo** — ${pill(Boolean(joinToCreateConfig?.enabled))}`,
                            `🛡️ **Vai trò Tự động** — ${autoRoleId ? `✅ ${formatRoleMention(interaction.guild, autoRoleId)}` : '❌ Tắt'}`,
                        ].join('\n'),
                        inline: false,
                    },
                    // ── Channels ──
                    {
                        name: '📡 Kênh Đã Cấu hình',
                        value: [
                            `**Nhật ký Kiểm tra:** ${auditChannel}`,
                            `**Vòng đời Vé:** ${lifecycleChannel}`,
                            `**Bản ghi Vé:** ${transcriptChannel}`,
                            `**Báo cáo:** ${reportChannel}`,
                            `**Sinh nhật:** ${birthdayChannel}`,
                        ].join('\n'),
                        inline: false,
                    },
                    // ── Refresh stamp ──
                    {
                        name: '🕒 Ảnh chụp được lấy',
                        value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                        inline: true,
                    },
                )
                .setFooter({ text: 'Chỉ đọc — chạy /logging dashboard để quản lý cài đặt kiểm tra' })
                .setTimestamp();

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } catch (error) {
            logger.error('overview command error:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Lỗi Tổng quan', 'Không thể tải tổng quan hệ thống.')],
            });
        }
    },
};
    
