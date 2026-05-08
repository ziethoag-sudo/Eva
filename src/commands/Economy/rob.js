import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { MessageTemplates } from '../../utils/messageTemplates.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const ROB_COOLDOWN = 4 * 60 * 60 * 1000;
const BASE_ROB_SUCCESS_CHANCE = 0.25;
const ROB_PERCENTAGE = 0.15;
const FINE_PERCENTAGE = 0.1;

export default {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Cố gắng cướp một người dùng khác (rất rủi ro)')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Người dùng cần cướp')
                .setRequired(true)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;
            
            const robberId = interaction.user.id;
            const victimUser = interaction.options.getUser("user");
            const guildId = interaction.guildId;
            const now = Date.now();

            if (robberId === victimUser.id) {
                throw createError(
                    "Không thể tự cướp mình",
                    ErrorTypes.VALIDATION,
                    "Bạn không thể tự cướp mình.",
                    { robberId, victimId: victimUser.id }
                );
            }
            
            if (victimUser.bot) {
                throw createError(
                    "Không thể cướp bot",
                    ErrorTypes.VALIDATION,
                    "Bạn không thể cướp bot.",
                    { victimId: victimUser.id, isBot: true }
                );
            }

            const robberData = await getEconomyData(client, guildId, robberId);
            const victimData = await getEconomyData(client, guildId, victimUser.id);
            
            if (!robberData || !victimData) {
                throw createError(
                    "Không thể tải dữ liệu kinh tế",
                    ErrorTypes.DATABASE,
                    "Không thể tải dữ liệu kinh tế. Vui lòng thử lại sau.",
                    { robberId: !!robberData, victimId: !!victimData, guildId }
                );
            }
            
            const lastRob = robberData.lastRob || 0;

            if (now < lastRob + ROB_COOLDOWN) {
                const remaining = lastRob + ROB_COOLDOWN - now;
                const hours = Math.floor(remaining / (1000 * 60 * 60));
                const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

                throw createError(
                    "Thời gian hồi chiêu cướp đang hoạt động",
                    ErrorTypes.RATE_LIMIT,
                    `Bạn cần nằm im. Chờ **${hours}h ${minutes}m** trước khi cố gắng cướp lần nữa.`,
                    { remaining, hours, minutes, cooldownType: 'rob' }
                );
            }

            if (victimData.wallet < 500) {
                throw createError(
                    "Nạn nhân quá nghèo",
                    ErrorTypes.VALIDATION,
                    `${victimUser.username} quá nghèo. Họ cần ít nhất $500 tiền mặt để đáng cướp.`,
                    { victimWallet: victimData.wallet, required: 500 }
                );
            }

            const hasSafe = victimData.inventory["personal_safe"] || 0;

            if (hasSafe > 0) {
                robberData.lastRob = now;
                await setEconomyData(client, guildId, robberId, robberData);

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        MessageTemplates.ERRORS.CONFIGURATION_REQUIRED(
                            "bảo vệ cướp",
                            `${victimUser.username} đã chuẩn bị! Nỗ lực của bạn thất bại vì họ sở hữu **Két cá nhân**. Bạn đã thoát sạch nhưng không giành được gì.`
                        )
                    ],
                });
            }

            const isSuccessful = Math.random() < BASE_ROB_SUCCESS_CHANCE;
            let resultEmbed;

            if (isSuccessful) {
                const amountStolen = Math.floor(victimData.wallet * ROB_PERCENTAGE);

                robberData.wallet = (robberData.wallet || 0) + amountStolen;
                victimData.wallet = (victimData.wallet || 0) - amountStolen;

                resultEmbed = MessageTemplates.SUCCESS.DATA_UPDATED(
                    "cướp",
                    `Bạn đã cướp thành công **$${amountStolen.toLocaleString()}** từ ${victimUser.username}!`
                );
            } else {
                const fineAmount = Math.floor((robberData.wallet || 0) * FINE_PERCENTAGE);

                if ((robberData.wallet || 0) < fineAmount) {
                    robberData.wallet = 0;
                } else {
                    robberData.wallet = (robberData.wallet || 0) - fineAmount;
                }

                resultEmbed = MessageTemplates.ERRORS.INSUFFICIENT_PERMISSIONS(
                    "cướp thất bại",
                    `Bạn đã thất bại trong vụ cướp và bị bắt! Bạn đã bị phạt **$${fineAmount.toLocaleString()}** tiền mặt của chính mình.`
                );
            }

            robberData.lastRob = now;

            await setEconomyData(client, guildId, robberId, robberData);
            await setEconomyData(client, guildId, victimUser.id, victimData);

            resultEmbed
                .addFields(
                    {
                        name: `Tiền mặt mới của bạn (${interaction.user.username})`,
                        value: `$${robberData.wallet.toLocaleString()}`,
                        inline: true,
                    },
                    {
                        name: `Tiền mặt mới của nạn nhân (${victimUser.username})`,
                        value: `$${victimData.wallet.toLocaleString()}`,
                        inline: true,
                    },
                )
                .setFooter({ text: `Vụ cướp tiếp theo có sẵn sau 4 giờ.` });

            await InteractionHelper.safeEditReply(interaction, { embeds: [resultEmbed] });
    }, { command: 'rob' })
};



