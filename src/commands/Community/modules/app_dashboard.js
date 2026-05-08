import { getColor } from '../../../config/bot.js';
import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags,
    ComponentType,
    EmbedBuilder,
    LabelBuilder,
    CheckboxBuilder,
    TextDisplayBuilder,
} from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { successEmbed, errorEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../../utils/errorHandler.js';
import { safeDeferInteraction } from '../../../utils/interactionValidator.js';
import {
    getApplicationSettings,
    saveApplicationSettings,
    getApplicationRoles,
    saveApplicationRoles,
    getApplicationRoleSettings,
    saveApplicationRoleSettings,
    deleteApplicationRoleSettings,
    getApplications,
    deleteApplication,
} from '../../../utils/database.js';

// ─── Embed & Menu Builders ────────────────────────────────────────────────────

function buildDashboardEmbed(settings, roles, guild) {
    const logChannel = settings.logChannelId ? `<#${settings.logChannelId}>` : '`Not set`';
    const managerRoleList =
        settings.managerRoles?.length > 0
            ? settings.managerRoles.map(id => `<@&${id}>`).join(', ')
            : '`None configured`';
    const roleList =
        roles.length > 0
            ? roles.map(r => `<@&${r.roleId}> — ${r.name}`).join('\n')
            : '`Không có vai trò ứng tuyển nào được cấu hình`';
    const questionCount = settings.questions?.length ?? 0;
    const firstQ =
        settings.questions?.[0]
            ? `\`${settings.questions[0].length > 55 ? settings.questions[0].substring(0, 55) + '…' : settings.questions[0]}\``
            : '`Chưa thiết lập`';

    return new EmbedBuilder()
        .setTitle('📋 Bảng điều khiển Ứng tuyển')
        .setDescription(`Quản lý cài đặt ứng tuyển cho **${guild.name}**.\nChọn một tùy chọn bên dưới để sửa đổi cài đặt.`)
        .setColor(getColor('info'))
        .addFields(
            { name: '⚙️ Trạng thái Ứng tuyển', value: settings.enabled ? '✅ Đã bật' : '❌ Đã tắt', inline: true },
            { name: '📢 Kênh Log', value: logChannel, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '🛡️ Vai trò Quản lý', value: managerRoleList, inline: false },
            { name: '📝 Câu hỏi', value: `${questionCount} đã cấu hình — đầu tiên: ${firstQ}`, inline: false },
            { name: '🎭 Vai trò Ứng tuyển', value: roleList, inline: false },
            {
                name: '🗑️ Lưu trữ',
                value: `Đang chờ: **${settings.pendingApplicationRetentionDays ?? 30}d** · Đã xem xét: **${settings.reviewedApplicationRetentionDays ?? 14}d**`,
                inline: false,
            },
        )
        .setFooter({ text: 'Bảng điều khiển đóng sau 15 phút không hoạt động' })
        .setTimestamp();
}

function buildSelectMenu(guildId) {
    return new StringSelectMenuBuilder()
        .setCustomId(`app_cfg_${guildId}`)
        .setPlaceholder('Chọn cài đặt để cấu hình...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Kênh Log')
                .setDescription('Thiết lập kênh nơi ghi lại đơn ứng tuyển mới')
                .setValue('log_channel')
                .setEmoji('📢'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Vai trò Quản lý')
                .setDescription('Thêm hoặc xóa vai trò có thể quản lý ứng tuyển')
                .setValue('manager_role')
                .setEmoji('🛡️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Chỉnh sửa Câu hỏi')
                .setDescription('Tùy chỉnh câu hỏi hiển thị trên biểu mẫu ứng tuyển')
                .setValue('questions')
                .setEmoji('📝'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Thêm Vai trò Ứng tuyển')
                .setDescription('Thêm vai trò mà thành viên có thể ứng tuyển')
                .setValue('role_add')
                .setEmoji('➕'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Xóa Vai trò Ứng tuyển')
                .setDescription('Xóa vai trò khỏi danh sách ứng tuyển')
                .setValue('role_remove')
                .setEmoji('➖'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Thời gian Lưu trữ')
                .setDescription('Thiết lập thời gian lưu trữ đơn ứng tuyển đang chờ và đã xem xét')
                .setValue('retention')
                .setEmoji('🗑️'),
        );
}

function buildButtonRow(settings, guildId, disabled = false) {
    const systemOn = settings.enabled === true;
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`app_cfg_toggle_${guildId}`)
            .setLabel('Ứng tuyển')
            .setStyle(systemOn ? ButtonStyle.Success : ButtonStyle.Danger)
            .setDisabled(disabled),
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function refreshDashboard(rootInteraction, settings, roles, guildId) {
    const selectMenu = buildSelectMenu(guildId);
    await InteractionHelper.safeEditReply(rootInteraction, {
        embeds: [buildDashboardEmbed(settings, roles, rootInteraction.guild)],
        components: [
            buildButtonRow(settings, guildId),
            new ActionRowBuilder().addComponents(selectMenu),
        ],
    }).catch(() => {});
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default {
    async execute(interaction, config, client, selectedAppName = null) {
        try {
            const guildId = interaction.guild.id;

            // Defer immediately to prevent Discord interaction timeout
            await InteractionHelper.safeDefer(interaction, { flags: ['Ephemeral'] });

            const [settings, roles] = await Promise.all([
                getApplicationSettings(client, guildId),
                getApplicationRoles(client, guildId),
            ]);

            // Check if application system is completely unconfigured
            const isCompletelyUnconfigured = 
                !settings.logChannelId && 
                !settings.enabled && 
                (settings.managerRoles?.length ?? 0) === 0 && 
                roles.length === 0;

            if (isCompletelyUnconfigured) {
                throw new TitanBotError(
                    'Hệ thống ứng tuyển chưa được thiết lập',
                    ErrorTypes.CONFIGURATION,
                    'Hệ thống ứng tuyển chưa được cấu hình. Vui lòng chạy `/app-admin setup` để tạo đơn ứng tuyển đầu tiên.',
                );
            }

            // If no application roles exist, show global settings to add one
            if (roles.length === 0) {
                await showGlobalDashboard(interaction, settings, roles, guildId, client);
                return;
            }

            // If a specific app was selected via autocomplete, show its dashboard directly
            if (selectedAppName) {
                const selectedRole = roles.find(r => r.name.toLowerCase() === selectedAppName.toLowerCase());
                if (selectedRole) {
                    await showApplicationDashboard(interaction, selectedRole, settings, roles, guildId, client);
                    return;
                }
                // If name doesn't match, fall through
            }

            // Default: Show first application if no selection made
            const defaultRole = roles[0];
            await showApplicationDashboard(interaction, defaultRole, settings, roles, guildId, client);

        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            logger.error('Unexpected error in app_dashboard:', error);
            throw new TitanBotError(
                `Bảng điều khiển ứng tuyển thất bại: ${error.message}`,
                ErrorTypes.UNKNOWN,
                'Không thể mở bảng điều khiển ứng tuyển.',
            );
        }
    },
};

// ─── Application Selector (for multiple applications) ──────────────────────────

async function showApplicationSelector(interaction, roles, settings, guildId, client) {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`app_select_${guildId}`)
        .setPlaceholder('Chọn đơn ứng tuyển để cấu hình...')
        .addOptions(
            roles.map(role =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(role.name)
                    .setDescription(`Cấu hình đơn ứng tuyển ${role.name}`)
                    .setValue(role.roleId)
                    .setEmoji('📋'),
            ),
        );

    const embed = new EmbedBuilder()
        .setTitle('🎯 Chọn Đơn Ứng tuyển')
        .setDescription('Chọn vai trò đơn ứng tuyển bạn muốn cấu hình.')
        .setColor(getColor('info'));

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(selectMenu)],
    });

    const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i =>
            i.user.id === interaction.user.id && i.customId === `app_select_${guildId}`,
        time: 600_000,
        max: 1,
    });

    collector.on('collect', async selectInteraction => {
        const deferred = await safeDeferInteraction(selectInteraction);
        if (!deferred) return;
        
        const selectedRoleId = selectInteraction.values[0];
        const selectedRole = roles.find(r => r.roleId === selectedRoleId);

        if (selectedRole) {
            await showApplicationDashboard(interaction, selectedRole, settings, roles, guildId, client);
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Hết thời gian', 'Không có lựa chọn nào được thực hiện. Bảng điều khiển đã đóng.')],
                components: [],
            }).catch(() => {});
        }
    });
}

// ─── Global Dashboard ──────────────────────────────────────────────────────────

async function showGlobalDashboard(interaction, settings, roles, guildId, client) {
    const selectMenu = buildSelectMenu(guildId);

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [buildDashboardEmbed(settings, roles, interaction.guild)],
        components: [
            buildButtonRow(settings, guildId),
            new ActionRowBuilder().addComponents(selectMenu),
        ],
    });

    setupCollectors(interaction, settings, roles, guildId, client, null);
}

// ─── Application-Specific Dashboard ────────────────────────────────────────────

async function showApplicationDashboard(rootInteraction, selectedRole, settings, roles, guildId, client) {
    const roleObj = rootInteraction.guild.roles.cache.get(selectedRole.roleId);
    
    // Get application-specific settings
    const appSettings = await getApplicationRoleSettings(client, guildId, selectedRole.roleId);
    const questions = appSettings.questions || settings.questions || [];
    const appLogChannelId = appSettings.logChannelId || settings.logChannelId;
    const isEnabled = selectedRole.enabled !== false; // Default to true if not specified

    // Build comprehensive embed
    const logChannelDisplay = appLogChannelId 
        ? `<#${appLogChannelId}>` 
        : '`Kế thừa kênh log toàn cục`';
    
    const questionsDisplay = questions.length > 0
        ? questions.map((q, i) => `${i + 1}. \`${q.length > 60 ? q.substring(0, 60) + '…' : q}\``).join('\n')
        : '`Kế thừa câu hỏi toàn cục`';
    
    const managerRolesDisplay = settings.managerRoles && settings.managerRoles.length > 0
        ? settings.managerRoles.map(id => `<@&${id}>`).join(', ')
        : '`Không có vai trò nào được cấu hình`';

    const embed = new EmbedBuilder()
        .setTitle('🎭 Bảng Điều khiển Đơn Ứng tuyển')
        .setDescription(`Cấu hình cho **${selectedRole.name}**`)
        .setColor(isEnabled ? getColor('success') : getColor('error'))
        .addFields(
            { 
                name: '🎭 Vai trò', 
                value: roleObj ? roleObj.toString() : `<@&${selectedRole.roleId}>`, 
                inline: true 
            },
            { 
                name: '⚙️ Trạng thái Đơn Ứng tuyển', 
                value: isEnabled ? '✅ **Đã bật**' : '❌ **Đã tắt**', 
                inline: true 
            },
            { name: '\u200B', value: '\u200B', inline: true },
            { 
                name: '📝 Câu hỏi', 
                value: questionsDisplay,
                inline: false 
            },
            { 
                name: '📢 Kênh Log', 
                value: logChannelDisplay,
                inline: true 
            },
            { 
                name: '🛡️ Vai trò Quản lý',
                value: managerRolesDisplay,
                inline: true 
            },
            { 
                name: '🗑️ Thời gian Lưu trữ',
                value: `Đang chờ: **${settings.pendingApplicationRetentionDays ?? 30}d** · Đã xem xét: **${settings.reviewedApplicationRetentionDays ?? 14}d**`,
                inline: false 
            },
        )
        .setFooter({ text: 'Bảng điều khiển đóng sau 10 phút không hoạt động' })
        .setTimestamp();

    // Create dropdown button with customization options
    const configMenu = buildApplicationSelectMenu(guildId, selectedRole.roleId);

    // Create control buttons
    const controlButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`app_toggle_${selectedRole.roleId}`)
            .setLabel(isEnabled ? 'Tắt Đơn Ứng tuyển' : 'Bật Đơn Ứng tuyển')
            .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`app_delete_${selectedRole.roleId}`)
            .setLabel('Xóa Đơn Ứng tuyển')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),
    );

    const menuRow = new ActionRowBuilder().addComponents(configMenu);

    await InteractionHelper.safeEditReply(rootInteraction, {
        embeds: [embed],
        components: [menuRow, controlButtons],
    });

    setupCollectors(rootInteraction, settings, roles, guildId, client, selectedRole.roleId);
}

// ─── Collector Setup ──────────────────────────────────────────────────────────

function setupCollectors(interaction, settings, roles, guildId, client, selectedRoleId) {
    const customIdPrefix = selectedRoleId ? `app_cfg_${selectedRoleId}` : `app_cfg_${guildId}`;
    
    const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i =>
            i.user.id === interaction.user.id && 
            (selectedRoleId 
                ? i.customId === customIdPrefix
                : (i.customId === `app_cfg_${guildId}` || i.customId === `app_select_${guildId}`)),
        time: 600_000,
    });

    collector.on('collect', async selectInteraction => {
        const selectedOption = selectInteraction.values[0];
        try {
            // Catch expired interactions
            if (!selectInteraction.isStringSelectMenu()) {
                return;
            }
            switch (selectedOption) {
                case 'log_channel':
                    await handleLogChannel(selectInteraction, interaction, settings, roles, guildId, client, selectedRoleId);
                    break;
                case 'manager_role':
                    await handleManagerRole(selectInteraction, interaction, settings, roles, guildId, client, selectedRoleId);
                    break;
                case 'questions':
                    await handleQuestions(selectInteraction, interaction, settings, roles, guildId, client, selectedRoleId);
                    break;
                case 'role_add':
                    await handleRoleAdd(selectInteraction, interaction, settings, roles, guildId, client);
                    break;
                case 'role_remove':
                    await handleRoleRemove(selectInteraction, interaction, settings, roles, guildId, client);
                    break;
                case 'retention':
                    await handleRetention(selectInteraction, interaction, settings, roles, guildId, client, selectedRoleId);
                    break;
            }
        } catch (error) {
            if (error instanceof TitanBotError) {
                logger.debug(`Applications config validation error: ${error.message}`);
            } else {
                logger.error('Unexpected applications dashboard error:', error);
            }

            const errorMessage =
                error instanceof TitanBotError
                    ? error.userMessage || 'An error occurred while processing your selection.'
                    : 'An unexpected error occurred while updating the configuration.';

            if (!selectInteraction.replied && !selectInteraction.deferred) {
                await safeDeferInteraction(selectInteraction);
            }

            await selectInteraction
                .followUp({
                    embeds: [errorEmbed('Configuration Error', errorMessage)],
                    flags: MessageFlags.Ephemeral,
                })
                .catch(() => {});
        }
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            const timeoutEmbed = new EmbedBuilder()
                .setTitle('\u23f0 Bảng Điều khiển Hết Thời Gian')
                .setDescription('Bảng điều khiển này đã được đóng do không hoạt động. Vui lòng chạy lệnh lại để tiếp tục.')
                .setColor(getColor('error'));
                
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [timeoutEmbed],
                components: [],
            }).catch(() => {});
        }
    });

    // ── Global Toggle Button Collector ──────────────────────────────────────────
    if (!selectedRoleId) {
        const globalToggleCollector = interaction.channel.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i =>
                i.user.id === interaction.user.id &&
                i.customId === `app_cfg_toggle_${guildId}`,
            time: 600_000,
        });

        globalToggleCollector.on('collect', async toggleInteraction => {
            const deferred = await safeDeferInteraction(toggleInteraction);
            if (!deferred) return;
            
            try {
                const wasEnabled = settings.enabled === true;
                settings.enabled = !wasEnabled;

                // Save the updated settings
                await saveApplicationSettings(interaction.client, guildId, settings);

                // Refresh dashboard to show new status
                const updatedSettings = await getApplicationSettings(interaction.client, guildId);
                const updatedRoles = await getApplicationRoles(interaction.client, guildId);
                await showGlobalDashboard(interaction, updatedSettings, updatedRoles, guildId, interaction.client);

                await toggleInteraction.followUp({
                    embeds: [successEmbed(
                        wasEnabled ? '🔴 Đã Tắt Ứng tuyển' : '🟢 Đã Bật Ứng tuyển',
                        `Hệ thống ứng tuyển hiện tại **${wasEnabled ? 'đã tắt' : 'đã bật'}**.\n\n${
                            wasEnabled 
                                ? 'Thành viên sẽ không thể ứng tuyển cho vai trò nữa.' 
                                : 'Thành viên bây giờ có thể bắt đầu ứng tuyển cho vai trò.'
                        }`,
                    )],
                    flags: MessageFlags.Ephemeral,
                });

            } catch (error) {
                logger.error('Error toggling global application status:', error);
                await toggleInteraction.followUp({
                    embeds: [errorEmbed('Error', 'An error occurred while toggling the application status.')],
                    flags: MessageFlags.Ephemeral,
                });
            }
        });

        globalToggleCollector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏱️ Configuration Timeout')
                    .setDescription('This dashboard session has timed out due to inactivity (10 minutes).\n\nTo continue configuring your applications, please run the command again.')
                    .setColor(getColor('warning'));
                    
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [timeoutEmbed],
                    components: [],
                }).catch(() => {});
            }
        });
    }

    // ── Delete Button Collector (for application-specific dashboard) ──────────────
    if (selectedRoleId) {
        const btnCollector = interaction.channel.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i =>
                i.user.id === interaction.user.id &&
                i.customId === `app_delete_${selectedRoleId}`,
            time: 600_000,
        });

        btnCollector.on('collect', async btnInteraction => {
            // Show confirmation modal
            const appRoleForDelete = roles.find(r => r.roleId === selectedRoleId);
            const appNameForDelete = appRoleForDelete?.name ?? 'this application';

            const confirmModal = new ModalBuilder()
                .setCustomId('app_delete_confirm')
                .setTitle('Xác nhận Xóa Đơn Ứng tuyển');

            const deleteWarningText = new TextDisplayBuilder()
                .setContent(`⚠️ Bạn sắp xóa vĩnh viễn **${appNameForDelete}**. Tất cả đơn ứng tuyển và cài đặt cho vai trò này sẽ bị xóa và không thể khôi phục.`);

            const deleteCheckbox = new CheckboxBuilder()
                .setCustomId('confirm_delete')
                .setDefault(false);

            const deleteCheckboxLabel = new LabelBuilder()
                .setLabel('Tôi xác nhận — điều này không thể hoàn tác')
                .setCheckboxComponent(deleteCheckbox);

            confirmModal
                .addTextDisplayComponents(deleteWarningText)
                .addLabelComponents(deleteCheckboxLabel);

            try {
                await btnInteraction.showModal(confirmModal);
            } catch (error) {
                logger.error('Error showing delete confirmation modal:', error);
                await btnInteraction.followUp({
                    embeds: [errorEmbed('Error', 'Failed to show confirmation modal. Please try again.')],
                    flags: MessageFlags.Ephemeral,
                }).catch(() => {});
                return;
            }

            try {
                const confirmSubmit = await btnInteraction.awaitModalSubmit({
                    time: 60_000,
                    filter: i =>
                        i.customId === 'app_delete_confirm' && i.user.id === btnInteraction.user.id,
                }).catch(() => null);

                if (!confirmSubmit) {
                    await btnInteraction.followUp({
                        embeds: [errorEmbed('Cancelled', 'Application deletion was cancelled.')],
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }

                const confirmed = confirmSubmit.fields.getCheckbox('confirm_delete');
                if (!confirmed) {
                    await confirmSubmit.reply({
                        embeds: [errorEmbed('Không Xác nhận', 'Bạn phải tích hộp kiểm xác nhận để xóa đơn ứng tuyển.')],
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }

                // Delete the application
                await handleDeleteApplication(confirmSubmit, selectedRoleId, guildId, roles, client);
                collector.stop();
                btnCollector.stop();

            } catch (error) {
                logger.error('Error confirming application deletion:', error);
                await btnInteraction.followUp({
                    embeds: [errorEmbed('Error', 'An error occurred while deleting the application.')],
                    flags: MessageFlags.Ephemeral,
                });
            }
        });

        btnCollector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏱️ Hết Thời Gian Cấu hình')
                    .setDescription('Phiên bảng điều khiển này đã hết thời gian do không hoạt động (10 phút).\n\nĐể tiếp tục cấu hình ứng tuyển của bạn, vui lòng chạy lệnh lại.')
                    .setColor(getColor('warning'));
                    
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [timeoutEmbed],
                    components: [],
                }).catch(() => {});
            }
        });

        // ── Toggle Enable/Disable Button Collector ──────────────────────────────
        const toggleCollector = interaction.channel.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i =>
                i.user.id === interaction.user.id &&
                i.customId === `app_toggle_${selectedRoleId}`,
            time: 900_000,
        });

        toggleCollector.on('collect', async toggleInteraction => {
            const deferred = await safeDeferInteraction(toggleInteraction);
            if (!deferred) return;
            
            try {
                // Find and toggle the role
                const roleIndex = roles.findIndex(r => r.roleId === selectedRoleId);
                if (roleIndex === -1) {
                    await toggleInteraction.followUp({
                        embeds: [errorEmbed('Not Found', 'Application role not found.')],
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }

                const wasEnabled = roles[roleIndex].enabled !== false;
                roles[roleIndex].enabled = !wasEnabled;

                // Save the updated roles
                await saveApplicationRoles(interaction.client, guildId, roles);

                // Refresh dashboard to show new status
                const updatedRole = roles[roleIndex];
                const updatedSettings = await getApplicationSettings(interaction.client, guildId);
                await showApplicationDashboard(interaction, updatedRole, updatedSettings, roles, guildId, interaction.client);

                await toggleInteraction.followUp({
                    embeds: [successEmbed(
                        wasEnabled ? '🔴 Đã Tắt Đơn Ứng tuyển' : '🟢 Đã Bật Đơn Ứng tuyển',
                        `Đơn ứng tuyển **${updatedRole.name}** hiện tại **${wasEnabled ? 'đã tắt' : 'đã bật'}**.\n\n${
                            wasEnabled 
                                ? 'Đơn ứng tuyển này sẽ không còn xuất hiện trong tùy chọn `/apply submit`.' 
                                : 'Đơn ứng tuyển này sẽ xuất hiện trong tùy chọn `/apply submit`.'
                        }`,
                    )],
                    flags: MessageFlags.Ephemeral,
                });

            } catch (error) {
                logger.error('Error toggling application status:', error);
                await toggleInteraction.followUp({
                    embeds: [errorEmbed('Error', 'An error occurred while toggling the application status.')],
                    flags: MessageFlags.Ephemeral,
                });
            }
        });

        toggleCollector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏱️ Configuration Timeout')
                    .setDescription('This dashboard session has timed out due to inactivity (10 minutes).\n\nTo continue configuring your applications, please run the command again.')
                    .setColor(getColor('warning'));
                    
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [timeoutEmbed],
                    components: [],
                }).catch(() => {});
            }
        });
    }
}

// ─── Build Select Menus ────────────────────────────────────────────────────────

function buildApplicationSelectMenu(guildId, roleId) {
    return new StringSelectMenuBuilder()
        .setCustomId(`app_cfg_${roleId}`)
        .setPlaceholder('Chọn cài đặt để cấu hình...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Kênh Log')
                .setDescription('Thiết lập kênh nơi ghi lại đơn ứng tuyển')
                .setValue('log_channel')
                .setEmoji('📢'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Vai trò Quản lý')
                .setDescription('Thêm hoặc xóa vai trò có thể quản lý ứng tuyển')
                .setValue('manager_role')
                .setEmoji('🛡️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Chỉnh sửa Câu hỏi')
                .setDescription('Tùy chỉnh câu hỏi hiển thị trên biểu mẫu ứng tuyển')
                .setValue('questions')
                .setEmoji('📝'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Thời gian Lưu trữ')
                .setDescription('Thiết lập thời gian lưu trữ đơn ứng tuyển đang chờ và đã xem xét')
                .setValue('retention')
                .setEmoji('🗑️'),
        );
}

// ─── Log Channel ──────────────────────────────────────────────────────────────

async function handleLogChannel(selectInteraction, rootInteraction, settings, roles, guildId, client, selectedRoleId) {
    const deferred = await safeDeferInteraction(selectInteraction);
    if (!deferred) return;

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('app_cfg_log_channel')
        .setPlaceholder('Select a text channel...')
        .addChannelTypes(ChannelType.GuildText)
        .setMaxValues(1);

    let currentChannel = settings.logChannelId;
    if (selectedRoleId) {
        const roleSettings = await getApplicationRoleSettings(client, guildId, selectedRoleId);
        currentChannel = roleSettings.logChannelId || settings.logChannelId;
    }

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('📢 Kênh Log')
                .setDescription(
                    `**Hiện tại:** ${currentChannel ? `<#${currentChannel}>` : '`Chưa thiết lập`'}\n\nChọn kênh nơi ghi lại đơn ứng tuyển mới.`,
                )
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(channelSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const chanCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'app_cfg_log_channel',
        time: 60_000,
        max: 1,
    });

    chanCollector.on('collect', async chanInteraction => {
        const deferred = await safeDeferInteraction(chanInteraction);
        if (!deferred) return;
        
        const channel = chanInteraction.channels.first();

        if (!channel.isTextBased()) {
            await chanInteraction.followUp({
                embeds: [errorEmbed('Kênh Không Hợp lệ', 'Vui lòng chọn kênh văn bản.')],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (selectedRoleId) {
            // Save per-application log channel
            const roleSettings = await getApplicationRoleSettings(client, guildId, selectedRoleId);
            roleSettings.logChannelId = channel.id;
            await saveApplicationRoleSettings(client, guildId, selectedRoleId, roleSettings);
        } else {
            // Save global log channel
            settings.logChannelId = channel.id;
            await saveApplicationSettings(client, guildId, settings);
        }

        await chanInteraction.followUp({
            embeds: [successEmbed('✅ Kênh Log Đã Cập Nhật', `Đơn ứng tuyển sẽ được ghi lại trong ${channel}.`)],
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(rootInteraction, settings, roles, guildId);
    });

    chanCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            selectInteraction.followUp({
                embeds: [errorEmbed('Hết Thời Gian', 'Không có kênh nào được chọn. Cài đặt không được thay đổi.')],
                flags: MessageFlags.Ephemeral,
            }).catch(() => {});
        }
    });
}

// ─── Manager Role ─────────────────────────────────────────────────────────────

async function handleManagerRole(selectInteraction, rootInteraction, settings, roles, guildId, client) {
    const deferred = await safeDeferInteraction(selectInteraction);
    if (!deferred) return;

    const currentRoles = settings.managerRoles ?? [];
    const currentList =
        currentRoles.length > 0 ? currentRoles.map(id => `<@&${id}>`).join(', ') : '`None`';

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('app_cfg_manager_role')
        .setPlaceholder('Select a role to add or remove...')
        .setMaxValues(1);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('🛡️ Vai trò Quản lý')
                .setDescription(
                    `**Hiện tại:** ${currentList}\n\nChọn vai trò để **chuyển đổi** nó — chọn vai trò quản lý hiện tại sẽ xóa nó, chọn vai trò mới sẽ thêm nó.`,
                )
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(roleSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const roleCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.RoleSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'app_cfg_manager_role',
        time: 60_000,
        max: 1,
    });

    roleCollector.on('collect', async roleInteraction => {
        const deferred = await safeDeferInteraction(roleInteraction);
        if (!deferred) return;
        
        const role = roleInteraction.roles.first();
        const roleSet = new Set(settings.managerRoles ?? []);
        const wasPresent = roleSet.has(role.id);

        if (wasPresent) {
            roleSet.delete(role.id);
        } else {
            roleSet.add(role.id);
        }

        settings.managerRoles = Array.from(roleSet);
        await saveApplicationSettings(client, guildId, settings);

        await roleInteraction.followUp({
            embeds: [
                successEmbed(
                    '✅ Vai trò Quản lý Đã Cập Nhật',
                    `${role} đã được **${wasPresent ? 'xóa khỏi' : 'thêm vào'}** danh sách vai trò quản lý.`,
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(rootInteraction, settings, roles, guildId);
    });

    roleCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            selectInteraction.followUp({
                embeds: [errorEmbed('Hết Thời Gian', 'Không có vai trò nào được chọn. Cài đặt không được thay đổi.')],
                flags: MessageFlags.Ephemeral,
            }).catch(() => {});
        }
    });
}

// ─── Edit Questions ───────────────────────────────────────────────────────────

async function handleQuestions(selectInteraction, rootInteraction, settings, roles, guildId, client, selectedRoleId) {
    let currentQuestions = settings.questions ?? [];
    
    if (selectedRoleId) {
        const roleSettings = await getApplicationRoleSettings(client, guildId, selectedRoleId);
        currentQuestions = roleSettings.questions ?? currentQuestions;
    }

    const modal = new ModalBuilder()
        .setCustomId('app_cfg_questions')
        .setTitle('Chỉnh sửa Câu hỏi Ứng tuyển')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('q1')
                    .setLabel('Câu hỏi 1 (bắt buộc)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(currentQuestions[0] ?? '')
                    .setMaxLength(100)
                    .setMinLength(1)
                    .setRequired(true),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('q2')
                    .setLabel('Câu hỏi 2 (tùy chọn)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(currentQuestions[1] ?? '')
                    .setMaxLength(100)
                    .setRequired(false),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('q3')
                    .setLabel('Câu hỏi 3 (tùy chọn)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(currentQuestions[2] ?? '')
                    .setMaxLength(100)
                    .setRequired(false),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('q4')
                    .setLabel('Câu hỏi 4 (tùy chọn)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(currentQuestions[3] ?? '')
                    .setMaxLength(100)
                    .setRequired(false),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('q5')
                    .setLabel('Câu hỏi 5 (tùy chọn)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(currentQuestions[4] ?? '')
                    .setMaxLength(100)
                    .setRequired(false),
            ),
        );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'app_cfg_questions' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const newQuestions = ['q1', 'q2', 'q3', 'q4', 'q5']
        .map(key => submitted.fields.getTextInputValue(key).trim())
        .filter(Boolean);

    if (newQuestions.length === 0) {
        await submitted.reply({
            embeds: [errorEmbed('Không có Câu hỏi', 'Ít nhất một câu hỏi là bắt buộc.')],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (selectedRoleId) {
        // Save per-application questions
        const roleSettings = await getApplicationRoleSettings(client, guildId, selectedRoleId);
        roleSettings.questions = newQuestions;
        await saveApplicationRoleSettings(client, guildId, selectedRoleId, roleSettings);
    } else {
        // Save global questions
        settings.questions = newQuestions;
        await saveApplicationSettings(client, guildId, settings);
    }

    await submitted.reply({
        embeds: [
            successEmbed(
                '✅ Câu hỏi Đã Cập Nhật',
                `${newQuestions.length} câu hỏi đã lưu.`,
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, settings, roles, guildId);
}

// ─── Add Application Role ─────────────────────────────────────────────────────

async function handleRoleAdd(selectInteraction, rootInteraction, settings, roles, guildId, client) {
    const deferred = await safeDeferInteraction(selectInteraction);
    if (!deferred) return;

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('app_cfg_role_add_pick')
        .setPlaceholder('Select the Discord role to add...')
        .setMaxValues(1);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('➕ Thêm Vai trò Ứng tuyển')
                .setDescription(
                    'Chọn vai trò mà thành viên có thể ứng tuyển. Bạn có thể tùy chọn thiết lập tên hiển thị sau khi chọn.',
                )
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(roleSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const roleCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.RoleSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'app_cfg_role_add_pick',
        time: 60_000,
        max: 1,
    });

    roleCollector.on('collect', async roleInteraction => {
        const role = roleInteraction.roles.first();

        // Check for duplicate
        if (roles.some(r => r.roleId === role.id)) {
            const deferred = await safeDeferInteraction(roleInteraction);
            if (!deferred) return;
            
            await roleInteraction.followUp({
                embeds: [errorEmbed('Already Added', `${role} is already an application role.`)],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // Show modal for optional custom name
        const nameModal = new ModalBuilder()
            .setCustomId('app_cfg_role_add_name')
            .setTitle('Tên Vai trò Ứng tuyển')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('role_name')
                        .setLabel('Tên hiển thị (để trống để sử dụng tên vai trò)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(role.name)
                        .setMaxLength(50)
                        .setRequired(false),
                ),
            );

        await roleInteraction.showModal(nameModal);

        const nameSubmit = await roleInteraction
            .awaitModalSubmit({
                filter: i =>
                    i.customId === 'app_cfg_role_add_name' && i.user.id === roleInteraction.user.id,
                time: 60_000,
            })
            .catch(() => null);

        if (!nameSubmit) return;

        const customName = nameSubmit.fields.getTextInputValue('role_name').trim() || role.name;

        roles.push({ roleId: role.id, name: customName });
        await saveApplicationRoles(client, guildId, roles);

        await nameSubmit.reply({
            embeds: [
                successEmbed(
                    '✅ Vai trò Đã Thêm',
                    `${role} đã được thêm làm vai trò ứng tuyển với tên **${customName}**.`,
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(rootInteraction, settings, roles, guildId);
    });

    roleCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            selectInteraction.followUp({
                embeds: [errorEmbed('Hết Thời Gian', 'Không có vai trò nào được chọn. Không có gì được thêm.')],
                flags: MessageFlags.Ephemeral,
            }).catch(() => {});
        }
    });
}

// ─── Remove Application Role ──────────────────────────────────────────────────

async function handleRoleRemove(selectInteraction, rootInteraction, settings, roles, guildId, client) {
    const deferred = await safeDeferInteraction(selectInteraction);
    if (!deferred) return;

    if (roles.length === 0) {
        await selectInteraction.followUp({
            embeds: [errorEmbed('No Roles', 'There are no application roles configured to remove.')],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('app_cfg_role_remove_pick')
        .setPlaceholder('Select the role to remove...')
        .setMaxValues(1);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('➖ Xóa Vai trò Ứng tuyển')
                .setDescription(
                    `**Vai trò hiện tại:** ${roles.map(r => `<@&${r.roleId}> (${r.name})`).join(', ')}\n\nChọn vai trò để xóa khỏi danh sách ứng tuyển.`,
                )
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(roleSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const roleCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.RoleSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'app_cfg_role_remove_pick',
        time: 60_000,
        max: 1,
    });

    roleCollector.on('collect', async roleInteraction => {
        const deferred = await safeDeferInteraction(roleInteraction);
        if (!deferred) return;
        
        const role = roleInteraction.roles.first();
        const index = roles.findIndex(r => r.roleId === role.id);

        if (index === -1) {
            await roleInteraction.followUp({
                embeds: [errorEmbed('Not Found', `${role} is not in the application roles list.`)],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        roles.splice(index, 1);
        await saveApplicationRoles(client, guildId, roles);

        await roleInteraction.followUp({
            embeds: [successEmbed('✅ Vai trò Đã Xóa', `${role} đã được xóa khỏi danh sách vai trò ứng tuyển.`)],
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(rootInteraction, settings, roles, guildId);
    });

    roleCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            selectInteraction.followUp({
                embeds: [errorEmbed('Hết Thời Gian', 'Không có vai trò nào được chọn. Không có gì được xóa.')],
                flags: MessageFlags.Ephemeral,
            }).catch(() => {});
        }
    });
}

// ─── Retention Period ─────────────────────────────────────────────────────────

async function handleRetention(selectInteraction, rootInteraction, settings, roles, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('app_cfg_retention')
        .setTitle('Thời gian Lưu trữ Ứng tuyển');

    const retentionInfo = new TextDisplayBuilder()
        .setContent(
            '**Đang chờ** — thời gian lưu trữ đơn ứng tuyển chưa trả lời/chưa xử lý trước khi bị xóa tự động.\n' +
            '**Đã xem xét** — thời gian lưu trữ đơn ứng tuyển đã chấp nhận hoặc từ chối.\n' +
            '-# Nhập số nguyên từ 1 đến 3650 (tối đa 10 năm).',
        );

    const pendingLabel = new LabelBuilder()
        .setLabel('Thời gian lưu trữ đang chờ (ngày)')
        .setTextInputComponent(
            new TextInputBuilder()
                .setCustomId('pending_days')
                .setStyle(TextInputStyle.Short)
                .setValue(String(settings.pendingApplicationRetentionDays ?? 30))
                .setMaxLength(4)
                .setMinLength(1)
                .setRequired(true),
        );

    const reviewedLabel = new LabelBuilder()
        .setLabel('Thời gian lưu trữ đã xem xét (ngày)')
        .setTextInputComponent(
            new TextInputBuilder()
                .setCustomId('reviewed_days')
                .setStyle(TextInputStyle.Short)
                .setValue(String(settings.reviewedApplicationRetentionDays ?? 14))
                .setMaxLength(4)
                .setMinLength(1)
                .setRequired(true),
        );

    modal
        .addTextDisplayComponents(retentionInfo)
        .addLabelComponents(pendingLabel, reviewedLabel);

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'app_cfg_retention' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const pendingDays = parseInt(submitted.fields.getTextInputValue('pending_days').trim(), 10);
    const reviewedDays = parseInt(submitted.fields.getTextInputValue('reviewed_days').trim(), 10);

    if (isNaN(pendingDays) || pendingDays < 1 || pendingDays > 3650) {
        await submitted.reply({
            embeds: [errorEmbed('Giá trị Không Hợp lệ', 'Thời gian lưu trữ đang chờ phải là số nguyên từ **1** đến **3650** ngày.')],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (isNaN(reviewedDays) || reviewedDays < 1 || reviewedDays > 3650) {
        await submitted.reply({
            embeds: [errorEmbed('Giá trị Không Hợp lệ', 'Thời gian lưu trữ đã xem xét phải là số nguyên từ **1** đến **3650** ngày.')],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    settings.pendingApplicationRetentionDays = pendingDays;
    settings.reviewedApplicationRetentionDays = reviewedDays;
    await saveApplicationSettings(client, guildId, settings);

    await submitted.reply({
        embeds: [
            successEmbed(
                '✅ Thời gian Lưu trữ Đã Cập Nhật',
                `Đơn ứng tuyển đang chờ sẽ được lưu trữ trong **${pendingDays} ngày**.\nĐơn ứng tuyển đã xem xét sẽ được lưu trữ trong **${reviewedDays} ngày**.`,
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, settings, roles, guildId);
}

// ─── Delete Application ───────────────────────────────────────────────────────

async function handleDeleteApplication(confirmSubmit, selectedRoleId, guildId, roles, client) {
    try {
        // Find the application in the roles array
        const roleIndex = roles.findIndex(r => r.roleId === selectedRoleId);
        if (roleIndex === -1) {
            await confirmSubmit.reply({
                embeds: [errorEmbed('Not Found', 'Application role not found.')],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const deletedRole = roles[roleIndex];

        // Remove from roles array
        roles.splice(roleIndex, 1);

        // Save updated roles list
        await saveApplicationRoles(client, guildId, roles);

        // Delete per-application settings
        await deleteApplicationRoleSettings(client, guildId, selectedRoleId);

        // Get all applications for this guild and find ones with this roleId
        const allApplications = await getApplications(client, guildId);
        const applicationsToDelete = allApplications.filter(app => app.roleId === selectedRoleId);

        // Delete each application
        for (const app of applicationsToDelete) {
            await deleteApplication(client, guildId, app.id, app.userId);
        }

        // Send success message
        await confirmSubmit.reply({
            embeds: [
                successEmbed(
                    '🗑️ Đã Xóa Đơn Ứng tuyển',
                    `Đơn ứng tuyển cho <@&${selectedRoleId}> (**${deletedRole.name}**) đã được xóa vĩnh viễn.\n\n` +
                    `Đã xóa: **${applicationsToDelete.length}** đơn ứng tuyển`,
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });

    } catch (error) {
        logger.error('Error in handleDeleteApplication:', error);
        await confirmSubmit.reply({
            embeds: [errorEmbed('Error', 'An error occurred while deleting the application. Please try again.')],
            flags: MessageFlags.Ephemeral,
        });
    }
}
