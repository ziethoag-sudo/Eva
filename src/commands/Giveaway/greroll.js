import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes, handleInteractionError } from '../../utils/errorHandler.js';
import { getGuildGiveaways, saveGiveaway } from '../../utils/giveaways.js';
import { 
    selectWinners,
    createGiveawayEmbed, 
    createGiveawayButtons 
} from '../../services/giveawayService.js';
import { logEvent, EVENT_TYPES } from '../../services/loggingService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("greroll")
        .setDescription("Chọn lại người thắng cho giveaway đã kết thúc.")
        .addStringOption((option) =>
            option
                .setName("messageid")
                .setDescription("ID tin nhắn của giveaway đã kết thúc.")
                .setRequired(true),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        try {
            
            if (!interaction.inGuild()) {
                throw new TitanBotError(
                    'Lệnh giveaway được dùng ngoài máy chủ',
                    ErrorTypes.VALIDATION,
                    'Lệnh này chỉ có thể sử dụng trong máy chủ.',
                    { userId: interaction.user.id }
                );
            }

            
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                throw new TitanBotError(
                    'User lacks ManageGuild permission',
                    ErrorTypes.PERMISSION,
                    "Bạn cần quyền 'Quản lý máy chủ' để quay lại người thắng giveaway.",
                    { userId: interaction.user.id, guildId: interaction.guildId }
                );
            }

            logger.info(`Bắt đầu quay lại giveaway bởi ${interaction.user.tag} trong máy chủ ${interaction.guildId}`);

            const messageId = interaction.options.getString("messageid");

            
            if (!messageId || !/^\d+$/.test(messageId)) {
                throw new TitanBotError(
                    'Invalid message ID format',
                    ErrorTypes.VALIDATION,
                    'Vui lòng cung cấp ID tin nhắn hợp lệ.',
                    { providedId: messageId }
                );
            }

            const giveaways = await getGuildGiveaways(
                interaction.client,
                interaction.guildId,
            );

            
            const giveaway = giveaways.find(g => g.messageId === messageId);

            if (!giveaway) {
                throw new TitanBotError(
                    `Giveaway not found: ${messageId}`,
                    ErrorTypes.VALIDATION,
                    "Không tìm thấy giveaway với ID tin nhắn đó trong cơ sở dữ liệu.",
                    { messageId, guildId: interaction.guildId }
                );
            }

            
            if (!giveaway.isEnded && !giveaway.ended) {
                throw new TitanBotError(
                    `Giveaway still active: ${messageId}`,
                    ErrorTypes.VALIDATION,
                    "Giveaway này vẫn đang hoạt động. Vui lòng dùng `/gend` để kết thúc trước.",
                    { messageId, status: 'active' }
                );
            }

            const participants = giveaway.participants || [];
            
            if (participants.length < giveaway.winnerCount) {
                throw new TitanBotError(
                    `Insufficient participants for reroll: ${participants.length} < ${giveaway.winnerCount}`,
                    ErrorTypes.VALIDATION,
                    "Không đủ lượt tham gia để chọn số người thắng yêu cầu.",
                    { participantsCount: participants.length, winnersNeeded: giveaway.winnerCount }
                );
            }

            
            const newWinners = selectWinners(
                participants,
                giveaway.winnerCount,
            );

            
            const updatedGiveaway = {
                ...giveaway,
                winnerIds: newWinners,
                rerolledAt: new Date().toISOString(),
                rerolledBy: interaction.user.id
            };

            
            const channel = await interaction.client.channels.fetch(
                giveaway.channelId,
            ).catch(err => {
                logger.warn(`Không thể lấy kênh ${giveaway.channelId}:`, err.message);
                return null;
            });

            if (!channel || !channel.isTextBased()) {
                
                await saveGiveaway(
                    interaction.client,
                    interaction.guildId,
                    updatedGiveaway,
                );
                
                logger.warn(`Không thể tìm kênh cho giveaway ${messageId}, nhưng đã lưu người thắng mới vào cơ sở dữ liệu`);
                
                return InteractionHelper.safeReply(interaction, {
                    embeds: [
                        successEmbed(
                            "Quay lại hoàn tất",
                            "Người thắng mới đã được chọn và lưu vào cơ sở dữ liệu. Không tìm thấy kênh để thông báo.",
                        ),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
            }

            
            const message = await channel.messages
                .fetch(messageId)
                .catch(err => {
                    logger.warn(`Không thể lấy tin nhắn ${messageId}:`, err.message);
                    return null;
                });

            if (!message) {
                
                await saveGiveaway(
                    interaction.client,
                    interaction.guildId,
                    updatedGiveaway,
                );

                const winnerMentions = newWinners
                    .map((id) => `<@${id}>`)
                    .join(", ");
                
                // Edit the original winner ping if it still exists, otherwise send a new one
                const existingPingMsg = giveaway.winnerPingMessageId
                    ? await channel.messages.fetch(giveaway.winnerPingMessageId).catch(() => null)
                    : null;
                if (existingPingMsg) {
                    await existingPingMsg.edit({
                        content: `🔄 **QUAY LẠI GIVEAWAY** 🔄 Người thắng mới cho **${giveaway.prize}**: ${winnerMentions}!`,
                    });
                } else {
                    const newPingMsg = await channel.send({
                        content: `🔄 **QUAY LẠI GIVEAWAY** 🔄 Người thắng mới cho **${giveaway.prize}**: ${winnerMentions}!`,
                    });
                    updatedGiveaway.winnerPingMessageId = newPingMsg.id;
                }

                logger.info(`Đã quay lại giveaway (không tìm thấy tin nhắn gốc, nhưng đã thông báo): ${messageId}`);

                try {
                    await logEvent({
                        client: interaction.client,
                        guildId: interaction.guildId,
                        eventType: EVENT_TYPES.GIVEAWAY_REROLL,
                        data: {
                            description: `Đã quay lại giveaway: ${giveaway.prize}`,
                            channelId: giveaway.channelId,
                            userId: interaction.user.id,
                            fields: [
                                {
                                    name: '🎁 Phần thưởng',
                                    value: giveaway.prize || 'Phần thưởng bí ẩn!',
                                    inline: true
                                },
                                {
                                    name: '🏆 Người thắng mới',
                                    value: winnerMentions,
                                    inline: false
                                },
                                {
                                    name: '👥 Tổng lượt tham gia',
                                    value: participants.length.toString(),
                                    inline: true
                                }
                            ]
                        }
                    });
                } catch (logError) {
                    logger.debug('Lỗi ghi log quay lại giveaway:', logError);
                }

                return InteractionHelper.safeReply(interaction, {
                    embeds: [
                        successEmbed(
                            "Quay lại hoàn tất",
                            `Người thắng mới đã được thông báo trong ${channel}. (Không tìm thấy tin nhắn gốc).`,
                        ),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
            }

            
            await saveGiveaway(
                interaction.client,
                interaction.guildId,
                updatedGiveaway,
            );

            const newEmbed = createGiveawayEmbed(updatedGiveaway, "reroll", newWinners);
            const newRow = createGiveawayButtons(true);

            await message.edit({
                content: "🔄 **GIVEAWAY ĐÃ QUAY LẠI** 🔄",
                embeds: [newEmbed],
                components: [newRow],
            });

            const winnerMentions = newWinners
                .map((id) => `<@${id}>`)
                .join(", ");
            
            // Edit the original winner ping if it still exists, otherwise send a new one
            const existingPingMsg = giveaway.winnerPingMessageId
                ? await channel.messages.fetch(giveaway.winnerPingMessageId).catch(() => null)
                : null;
            if (existingPingMsg) {
                await existingPingMsg.edit({
                    content: `🔄 **QUAY LẠI NGƯỜI THẮNG** 🔄 CHÚC MỪNG ${winnerMentions}! Bạn là người thắng mới cho giveaway **${giveaway.prize}**! Vui lòng liên hệ người tổ chức <@${giveaway.hostId}> để nhận phần thưởng.`,
                });
            } else {
                const newPingMsg = await channel.send({
                    content: `🔄 **QUAY LẠI NGƯỜI THẮNG** 🔄 CHÚC MỪNG ${winnerMentions}! Bạn là người thắng mới cho giveaway **${giveaway.prize}**! Vui lòng liên hệ người tổ chức <@${giveaway.hostId}> để nhận phần thưởng.`,
                });
                updatedGiveaway.winnerPingMessageId = newPingMsg.id;
            }

            logger.info(`Quay lại giveaway thành công: ${messageId} với ${newWinners.length} người thắng mới`);

            try {
                await logEvent({
                    client: interaction.client,
                    guildId: interaction.guildId,
                    eventType: EVENT_TYPES.GIVEAWAY_REROLL,
                    data: {
                        description: `Đã quay lại giveaway: ${giveaway.prize}`,
                        channelId: giveaway.channelId,
                        userId: interaction.user.id,
                        fields: [
                            {
                                name: '🎁 Phần thưởng',
                                value: giveaway.prize || 'Mystery Prize!',
                                inline: true
                            },
                            {
                                name: '🏆 Người thắng mới',
                                value: winnerMentions,
                                inline: false
                            },
                            {
                                name: '👥 Tổng lượt tham gia',
                                value: participants.length.toString(),
                                inline: true
                            }
                        ]
                    }
                });
            } catch (logError) {
                logger.debug('Lỗi ghi log sự kiện quay lại giveaway:', logError);
            }

            return InteractionHelper.safeReply(interaction, {
                embeds: [
                    successEmbed(
                        "Quay lại thành công ✅",
                        `Đã quay lại thành công giveaway với **${giveaway.prize}** tại ${channel}. Đã chọn ${newWinners.length} người thắng mới.`,
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });

        } catch (error) {
            logger.error('Error in greroll command:', error);
            await handleInteractionError(interaction, error, {
                type: 'command',
                commandName: 'greroll',
                context: 'giveaway_reroll'
            });
        }
    },
};



