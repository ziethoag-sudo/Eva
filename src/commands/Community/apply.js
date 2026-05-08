import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import ApplicationService from '../../services/applicationService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { 
    getApplicationSettings, 
    getUserApplications, 
    createApplication, 
    getApplication,
    getApplicationRoles,
    updateApplication,
    getApplicationRoleSettings
} from '../../utils/database.js';

function getApplicationStatusPresentation(statusValue) {
    const normalized = typeof statusValue === 'string' ? statusValue.trim().toLowerCase() : 'unknown';
    const statusLabel =
        normalized === 'pending' ? 'Đang xử lý' :
        normalized === 'approved' ? 'Đã chấp nhận' :
        normalized === 'denied' ? 'Đã từ chối' :
        'Không xác định';
    const statusEmoji =
        normalized === 'pending' ? '🟡' :
        normalized === 'approved' ? '🟢' :
        normalized === 'denied' ? '🔴' :
        '⚪';

    return { normalized, statusLabel, statusEmoji };
}

export default {
    data: new SlashCommandBuilder()
        .setName("ungdung")
        .setDescription("Quản lý ứng dụng vai trò")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("nop")
                .setDescription("Nộp đơn ứng tuyển cho vai trò")
                .addStringOption((option) =>
                    option
                        .setName("ungdung")
                        .setDescription("Đơn ứng tuyển bạn muốn nộp")
                        .setRequired(true)
                        .setAutocomplete(true),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("trangthai")
                .setDescription("Kiểm tra trạng thái đơn ứng tuyển của bạn")
                .addStringOption((option) =>
                    option
                        .setName("id")
                        .setDescription("ID đơn ứng tuyển (để trống để xem tất cả)")
                        .setRequired(false),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("danhsach")
                .setDescription("Liệt kê các đơn ứng tuyển có sẵn"),
        ),

    category: "Community",

    execute: withErrorHandling(async (interaction) => {
        if (!interaction.inGuild()) {
            return InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed("Lệnh này chỉ có thể được sử dụng trong máy chủ.")],
                flags: ["Ephemeral"],
            });
        }

        const { options, guild, member } = interaction;
        const subcommand = options.getSubcommand();

        if (subcommand !== "submit") {
            const isListCommand = subcommand === "list";
            await InteractionHelper.safeDefer(interaction, { flags: isListCommand ? [] : ["Ephemeral"] });
        }

        logger.info(`Apply command executed: ${subcommand}`, {
            userId: interaction.user.id,
            guildId: guild.id,
            subcommand
        });

        const settings = await getApplicationSettings(
            interaction.client,
            guild.id,
        );
        
        if (!settings.enabled) {
            throw createError(
                'Ứng dụng bị tắt',
                ErrorTypes.CONFIGURATION,
                'Ứng dụng hiện tại bị tắt trong máy chủ này.',
                { guildId: guild.id }
            );
        }

        if (subcommand === "submit") {
            await handleSubmit(interaction, settings);
        } else if (subcommand === "status") {
            await handleStatus(interaction);
        } else if (subcommand === "list") {
            await handleList(interaction);
        }
    }, { type: 'command', commandName: 'apply' })
};

export async function handleApplicationModal(interaction) {
    if (!interaction.isModalSubmit()) return;
    
    const customId = interaction.customId;
    if (!customId.startsWith('app_modal_')) return;
    
    const roleId = customId.split('_')[2];
    
    const applicationRoles = await getApplicationRoles(interaction.client, interaction.guild.id);
    const applicationRole = applicationRoles.find(appRole => appRole.roleId === roleId);
    
    if (!applicationRole) {
        return InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Không tìm thấy cấu hình ứng dụng.')],
            flags: ["Ephemeral"]
        });
    }
    
    const role = interaction.guild.roles.cache.get(roleId);
    
    if (!role) {
        return InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Không tìm thấy vai trò.')],
            flags: ["Ephemeral"]
        });
    }
    
    const answers = [];
    const settings = await getApplicationSettings(interaction.client, interaction.guild.id);
    
    // Get questions - use per-application questions if they exist, otherwise use global
    let questions = settings.questions || ["Tại sao bạn muốn có vai trò này?", "Kinh nghiệm của bạn là gì?"];
    const roleSettings = await getApplicationRoleSettings(interaction.client, interaction.guild.id, roleId);
    if (roleSettings.questions && roleSettings.questions.length > 0) {
        questions = roleSettings.questions;
    }
    
    for (let i = 0; i < questions.length; i++) {
        const answer = interaction.fields.getTextInputValue(`q${i}`);
        answers.push({
            question: questions[i],
            answer: answer
        });
    }
    
    try {
        const application = await ApplicationService.submitApplication(interaction.client, {
            guildId: interaction.guild.id,
            userId: interaction.user.id,
            roleId: roleId,
            roleName: applicationRole.name,
            username: interaction.user.tag,
            avatar: interaction.user.displayAvatarURL(),
            answers: answers
        });
        
        const embed = successEmbed(
            'Đã nộp đơn ứng tuyển',
            `Đơn ứng tuyển của bạn cho **${applicationRole.name}** đã được nộp thành công!\n\n` +
            `ID đơn ứng tuyển: \`${application.id}\`\n` +
            `Bạn có thể kiểm tra trạng thái với \`/ungdung trangthai id:${application.id}\``
        );
        
        await InteractionHelper.safeEditReply(interaction, { embeds: [embed], flags: ["Ephemeral"] });
        
        const settings = await getApplicationSettings(interaction.client, interaction.guild.id);
        const roleSettings = await getApplicationRoleSettings(interaction.client, interaction.guild.id, roleId);
        
        // Use per-application log channel if exists, otherwise use global
        const logChannelId = roleSettings.logChannelId || settings.logChannelId;
        
        if (logChannelId) {
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel) {
                const logEmbed = createEmbed({
                    title: '📝 Đơn ứng tuyển mới',
                    description: `**Người dùng:** <@${interaction.user.id}> (${interaction.user.tag})\n` +
                        `**Ứng tuyển:** ${applicationRole.name}\n` +
                        `**Vai trò:** ${role.name}\n` +
                        `**ID đơn ứng tuyển:** \`${application.id}\`\n` +
                        `**Trạng thái:** 🟡 Đang xử lý`
                }).setColor(getColor('warning'));
                
                const logMessage = await logChannel.send({ embeds: [logEmbed] });
                
                await updateApplication(interaction.client, interaction.guild.id, application.id, {
                    logMessageId: logMessage.id,
                    logChannelId: logChannelId
                });
            }
        }
        
    } catch (error) {
        logger.error('Error creating application:', {
            error: error.message,
            userId: interaction.user.id,
            guildId: interaction.guild.id,
            roleId,
            stack: error.stack
        });
        
        await handleInteractionError(interaction, error, {
            type: 'modal',
            handler: 'application_submission'
        });
    }
}

async function handleList(interaction) {
    try {
        const applicationRoles = await getApplicationRoles(interaction.client, interaction.guild.id);
        
        if (applicationRoles.length === 0) {
            return InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed("Hiện tại không có đơn ứng tuyển nào có sẵn.")],
            });
        }

        const embed = createEmbed({
            title: "Đơn ứng tuyển có sẵn",
            description: "Đây là các vai trò bạn có thể ứng tuyển:"
        });

        applicationRoles.forEach((appRole, index) => {
            const role = interaction.guild.roles.cache.get(appRole.roleId);
            embed.addFields({
                name: `${index + 1}. ${appRole.name}`,
                value: `**Vai trò:** ${role ? `<@&${appRole.roleId}>` : 'Không tìm thấy vai trò'}\n` +
                       `**Ứng tuyển với:** \`/ungdung nop ungdung:"${appRole.name}"\``,
                inline: false
            });
        });

        embed.setFooter({
            text: "Dùng /ungdung nop ungdung:<tên> để ứng tuyển cho bất kỳ vai trò nào trong số này."
        });

        return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    } catch (error) {
        logger.error('Error listing applications:', {
            error: error.message,
            guildId: interaction.guild.id,
            stack: error.stack
        });
        
        throw createError(
            'Không thể tải đơn ứng tuyển',
            ErrorTypes.DATABASE,
            'Không thể tải đơn ứng tuyển. Vui lòng thử lại sau.',
            { guildId: interaction.guild.id }
        );
    }
}

async function handleSubmit(interaction, settings) {
    const applicationName = interaction.options.getString("ungdung");
    const member = interaction.member;

    const applicationRoles = await getApplicationRoles(interaction.client, interaction.guild.id);
    
    const applicationRole = applicationRoles.find(appRole => 
        appRole.name.toLowerCase() === applicationName.toLowerCase()
    );

    if (!applicationRole) {
        return InteractionHelper.safeEditReply(interaction, {
            embeds: [
                errorEmbed(
                    "Không tìm thấy đơn ứng tuyển.",
                    "Dùng `/ungdung danhsach` để xem các đơn ứng tuyển có sẵn."
                ),
            ],
            flags: ["Ephemeral"],
        });
    }

    const userApps = await getUserApplications(
        interaction.client,
        interaction.guild.id,
        interaction.user.id,
    );
    const pendingApp = userApps.find((app) => app.status === "pending");

    if (pendingApp) {
        return InteractionHelper.safeEditReply(interaction, {
            embeds: [
                errorEmbed(
                    `Bạn đã có một đơn ứng tuyển đang chờ. Vui lòng chờ nó được xem xét.`,
                ),
            ],
            flags: ["Ephemeral"],
        });
    }

    const role = interaction.guild.roles.cache.get(applicationRole.roleId);
    if (!role) {
        return InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Vai trò cho đơn ứng tuyển này không còn tồn tại.')],
            flags: ["Ephemeral"]
        });
    }

    const modal = new ModalBuilder()
        .setCustomId(`app_modal_${applicationRole.roleId}`)
        .setTitle(`Ứng tuyển cho ${applicationRole.name}`);

    // Get questions - use per-application questions if they exist, otherwise use global
    let questions = settings.questions || ["Tại sao bạn muốn có vai trò này?", "Kinh nghiệm của bạn là gì?"];
    const roleSettings = await getApplicationRoleSettings(interaction.client, interaction.guild.id, applicationRole.roleId);
    if (roleSettings.questions && roleSettings.questions.length > 0) {
        questions = roleSettings.questions;
    }

    questions.forEach((question, index) => {
        const input = new TextInputBuilder()
            .setCustomId(`q${index}`)
            .setLabel(
                question.length > 45
                    ? `${question.substring(0, 42)}...`
                    : question,
            )
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);
    });

    await interaction.showModal(modal);
}

async function handleStatus(interaction) {
    const appId = interaction.options.getString("id");

    if (appId) {
        const application = await getApplication(
            interaction.client,
            interaction.guild.id,
            appId,
        );

        if (!application || application.userId !== interaction.user.id) {
            return InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        "Không tìm thấy đơn ứng tuyển hoặc bạn không có quyền xem nó.",
                    ),
                ],
                flags: ["Ephemeral"],
            });
        }

        const submittedAt = application?.createdAt ? new Date(application.createdAt) : null;
        const submittedAtDisplay = submittedAt && !Number.isNaN(submittedAt.getTime())
            ? submittedAt.toLocaleString()
            : 'Unknown date';
        const statusView = getApplicationStatusPresentation(application.status);
        const embed = createEmbed({
            title: `Đơn ứng tuyển #${application.id} - ${application.roleName || 'Vai trò không xác định'}`,
            description:
                `**ID đơn ứng tuyển:** \`${application.id}\`\n` +
                `**Trạng thái:** ${statusView.statusEmoji} ${statusView.statusLabel}\n` +
                `**Đã nộp:** ${submittedAtDisplay}`
        });

        return InteractionHelper.safeEditReply(interaction, { embeds: [embed], flags: ["Ephemeral"] });
    } else {
        const applications = await getUserApplications(
            interaction.client,
            interaction.guild.id,
            interaction.user.id,
        );

        if (applications.length === 0) {
            return InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed("Bạn chưa nộp đơn ứng tuyển nào."),
                ],
                flags: ["Ephemeral"],
            });
        }

        const recentApplications = applications
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0, 10);

        const embed = createEmbed({
            title: "Đơn ứng tuyển của bạn",
            description: `Hiển thị ${recentApplications.length} đơn ứng tuyển gần đây.`
        });

        recentApplications.forEach((application) => {
            const submittedAt = application?.createdAt ? new Date(application.createdAt) : null;
            const submittedAtDisplay = submittedAt && !Number.isNaN(submittedAt.getTime())
                ? submittedAt.toLocaleDateString()
                : 'Unknown date';
            const statusView = getApplicationStatusPresentation(application.status);

            embed.addFields({
                name: `${statusView.statusEmoji} ${application.roleName || 'Vai trò không xác định'} (${statusView.statusLabel})`,
                value:
                    `**ID:** \`${application.id}\`\n` +
                    `**Trạng thái:** ${statusView.statusEmoji} ${statusView.statusLabel}\n` +
                    `**Đã nộp:** ${submittedAtDisplay}`,
                inline: true,
            });
        });

        if (applications.length > recentApplications.length) {
            embed.setFooter({ text: `Hiển thị ${recentApplications.length} đơn ứng tuyển gần đây nhất trong tổng số ${applications.length} đơn ứng tuyển.` });
        }

        return InteractionHelper.safeEditReply(interaction, { embeds: [embed], flags: ["Ephemeral"] });
    }
}



