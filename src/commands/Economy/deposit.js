import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData, getMaxBankCapacity } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { MessageTemplates } from '../../utils/messageTemplates.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Gửi tiền từ ví của bạn vào ngân hàng')
        .addStringOption(option =>
            option
                .setName('amount')
                .setDescription('Số tiền cần gửi (số hoặc "all")')
                .setRequired(true)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;
        
        const userId = interaction.user.id;
            const guildId = interaction.guildId;
            const amountInput = interaction.options.getString("amount");

            const userData = await getEconomyData(client, guildId, userId);
            
            if (!userData) {
                throw createError(
                    "Không thể tải dữ liệu kinh tế",
                    ErrorTypes.DATABASE,
                    "Không thể tải dữ liệu kinh tế của bạn. Vui lòng thử lại sau.",
                    { userId, guildId }
                );
            }
            
            const maxBank = getMaxBankCapacity(userData);
            let depositAmount;

            if (amountInput.toLowerCase() === "all") {
                depositAmount = userData.wallet;
            } else {
                depositAmount = parseInt(amountInput);

                if (isNaN(depositAmount) || depositAmount <= 0) {
                    throw createError(
                        "Số tiền gửi không hợp lệ",
                        ErrorTypes.VALIDATION,
                        `Vui lòng nhập số hợp lệ hoặc 'all'. Bạn đã nhập: \`${amountInput}\``,
                        { amountInput, userId }
                    );
                }
            }

            if (depositAmount === 0) {
                throw createError(
                    "Số tiền gửi bằng 0",
                    ErrorTypes.VALIDATION,
                    "Bạn không có tiền mặt để gửi.",
                    { userId, walletBalance: userData.wallet }
                );
            }

            if (depositAmount > userData.wallet) {
                depositAmount = userData.wallet;
                await interaction.followUp({
                    embeds: [
                        MessageTemplates.ERRORS.INVALID_INPUT(
                            "số tiền gửi",
                            `Bạn đã cố gắng gửi nhiều hơn số tiền bạn có. Đang gửi số tiền mặt còn lại: **$${depositAmount.toLocaleString()}**`
                        )
                    ],
                    flags: ["Ephemeral"],
                });
            }

            const availableSpace = maxBank - userData.bank;

            if (availableSpace <= 0) {
                throw createError(
                    "Ngân hàng đã đầy",
                    ErrorTypes.VALIDATION,
                    `Ngân hàng của bạn hiện đang đầy (Dung lượng tối đa: $${maxBank.toLocaleString()}). Mua **Nâng cấp Ngân hàng** để tăng giới hạn.`,
                    { maxBank, currentBank: userData.bank, userId }
                );
            }

            if (depositAmount > availableSpace) {
                const originalDepositAmount = depositAmount;
                depositAmount = availableSpace;

                if (amountInput.toLowerCase() !== "all") {
                    await interaction.followUp({
                        embeds: [
                            MessageTemplates.ERRORS.INVALID_INPUT(
                                "số tiền gửi",
                                `Bạn chỉ có chỗ cho **$${depositAmount.toLocaleString()}** trong tài khoản ngân hàng (Tối đa: $${maxBank.toLocaleString()}). Phần còn lại vẫn ở trong tiền mặt.`
                            )
                        ],
                        flags: ["Ephemeral"],
                    });
                }
            }

            if (depositAmount === 0) {
                throw createError(
                    "Không có chỗ hoặc tiền để gửi",
                    ErrorTypes.VALIDATION,
                    "Số tiền bạn cố gắng gửi là 0 hoặc vượt quá dung lượng ngân hàng sau khi kiểm tra số dư tiền mặt.",
                    { depositAmount, availableSpace, walletBalance: userData.wallet }
                );
            }

            userData.wallet -= depositAmount;
            userData.bank += depositAmount;

            await setEconomyData(client, guildId, userId, userData);

            const embed = MessageTemplates.SUCCESS.DATA_UPDATED(
                "gửi tiền",
                `Bạn đã gửi thành công **$${depositAmount.toLocaleString()}** vào ngân hàng.`
            )
                .addFields(
                    {
                        name: "💵 Số dư tiền mặt mới",
                        value: `$${userData.wallet.toLocaleString()}`,
                        inline: true,
                    },
                    {
                        name: "🏦 Số dư ngân hàng mới",
                        value: `$${userData.bank.toLocaleString()} / $${maxBank.toLocaleString()}`,
                        inline: true,
                    },
                );

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'deposit' })
};





