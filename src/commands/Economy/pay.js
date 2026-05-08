import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, addMoney, removeMoney, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { MessageTemplates } from '../../utils/messageTemplates.js';
import EconomyService from '../../services/economyService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Trả tiền cho một người dùng khác')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Người dùng cần trả tiền')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Số tiền cần trả')
                .setRequired(true)
                .setMinValue(1)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;
            
            const senderId = interaction.user.id;
            const receiver = interaction.options.getUser("user");
            const amount = interaction.options.getInteger("amount");
            const guildId = interaction.guildId;

            logger.debug(`[ECONOMY] Pay command initiated`, { 
                senderId, 
                receiverId: receiver.id,
                amount,
                guildId
            });

            if (receiver.bot) {
                throw createError(
                    "Không thể trả tiền cho bot",
                    ErrorTypes.VALIDATION,
                    "Bạn không thể trả tiền cho bot.",
                    { receiverId: receiver.id, isBot: true }
                );
            }
            
            if (receiver.id === senderId) {
                throw createError(
                    "Không thể tự trả tiền cho mình",
                    ErrorTypes.VALIDATION,
                    "Bạn không thể tự trả tiền cho mình.",
                    { senderId, receiverId: receiver.id }
                );
            }
            
            if (amount <= 0) {
                throw createError(
                    "Số tiền thanh toán không hợp lệ",
                    ErrorTypes.VALIDATION,
                    "Số tiền phải lớn hơn 0.",
                    { amount, senderId }
                );
            }

            const [senderData, receiverData] = await Promise.all([
                getEconomyData(client, guildId, senderId),
                getEconomyData(client, guildId, receiver.id)
            ]);

            if (!senderData) {
                throw createError(
                    "Không thể tải dữ liệu kinh tế của người gửi",
                    ErrorTypes.DATABASE,
                    "Không thể tải dữ liệu kinh tế của bạn. Vui lòng thử lại sau.",
                    { userId: senderId, guildId }
                );
            }
            
            if (!receiverData) {
                throw createError(
                    "Không thể tải dữ liệu kinh tế của người nhận",
                    ErrorTypes.DATABASE,
                    "Không thể tải dữ liệu kinh tế của người nhận. Vui lòng thử lại sau.",
                    { userId: receiver.id, guildId }
                );
            }

            
            
            const result = await EconomyService.transferMoney(
                client, 
                guildId, 
                senderId, 
                receiver.id, 
                amount
            );

            
            const updatedSenderData = await getEconomyData(client, guildId, senderId);
            const updatedReceiverData = await getEconomyData(client, guildId, receiver.id);

            const embed = MessageTemplates.SUCCESS.DATA_UPDATED(
                "thanh toán",
                `Bạn đã trả thành công cho **${receiver.username}** số tiền **$${amount.toLocaleString()}**!`
            )
                .addFields(
                    {
                        name: "💳 Số tiền thanh toán",
                        value: `$${amount.toLocaleString()}`,
                        inline: true,
                    },
                    {
                        name: "💵 Số dư mới của bạn",
                        value: `$${updatedSenderData.wallet.toLocaleString()}`,
                        inline: true,
                    },
                )
                .setFooter({
                    text: `Đã trả cho ${receiver.tag}`,
                    iconURL: receiver.displayAvatarURL(),
                });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

            logger.info(`[ECONOMY] Payment sent successfully`, {
                senderId,
                receiverId: receiver.id,
                amount,
                senderBalance: updatedSenderData.wallet,
                receiverBalance: updatedReceiverData.wallet
            });

            try {
                const receiverEmbed = createEmbed({ 
                    title: "💰 Thanh toán đến!", 
                    description: `${interaction.user.username} đã trả cho bạn **$${amount.toLocaleString()}**.` 
                }).addFields({
                    name: "Tiền mặt mới của bạn",
                    value: `$${updatedReceiverData.wallet.toLocaleString()}`,
                    inline: true,
                });
                await receiver.send({ embeds: [receiverEmbed] });
            } catch (e) {
                    logger.warn(`Could not DM user ${receiver.id}: ${e.message}`);
            }
    }, { command: 'pay' })
};





