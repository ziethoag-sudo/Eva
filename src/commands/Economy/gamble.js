import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { MessageTemplates } from '../../utils/messageTemplates.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const BASE_WIN_CHANCE = 0.4;
const CLOVER_WIN_BONUS = 0.1;
const CHARM_WIN_BONUS = 0.08;
const PAYOUT_MULTIPLIER = 2.0;
const GAMBLE_COOLDOWN = 5 * 60 * 1000;

export default {
    data: new SlashCommandBuilder()
        .setName('gamble')
        .setDescription('Đánh cược tiền của bạn để có cơ hội thắng nhiều hơn')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Số tiền mặt để đánh cược')
                .setRequired(true)
                .setMinValue(1)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;
            
            const userId = interaction.user.id;
            const guildId = interaction.guildId;
            const betAmount = interaction.options.getInteger("amount");
            const now = Date.now();

            const userData = await getEconomyData(client, guildId, userId);
            const lastGamble = userData.lastGamble || 0;
            let cloverCount = userData.inventory["lucky_clover"] || 0;
            let charmCount = userData.inventory["lucky_charm"] || 0;

            if (now < lastGamble + GAMBLE_COOLDOWN) {
                const remaining = lastGamble + GAMBLE_COOLDOWN - now;
                const minutes = Math.floor(remaining / (1000 * 60));
                const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

                throw createError(
                    "Thời gian hồi chiêu đánh cược đang hoạt động",
                    ErrorTypes.RATE_LIMIT,
                    `Bạn cần hạ nhiệt trước khi đánh cược lại. Chờ **${minutes}m ${seconds}s**.`,
                    { remaining, cooldownType: 'gamble' }
                );
            }

            if (userData.wallet < betAmount) {
                throw createError(
                    "Không đủ tiền mặt để đánh cược",
                    ErrorTypes.VALIDATION,
                    `Bạn chỉ có $${userData.wallet.toLocaleString()} tiền mặt, nhưng bạn đang cố gắng đặt cược $${betAmount.toLocaleString()}.`,
                    { required: betAmount, current: userData.wallet }
                );
            }

            let winChance = BASE_WIN_CHANCE;
            let cloverMessage = "";
            let usedClover = false;
            let usedCharm = false;

            
            if (cloverCount > 0) {
                winChance += CLOVER_WIN_BONUS;
                userData.inventory["lucky_clover"] -= 1;
                cloverMessage = `\n🍀 **Đã tiêu thụ Cỏ bốn lá May mắn:** Cơ hội thắng của bạn đã được tăng cường!`;
                usedClover = true;
            }
            
            else if (charmCount > 0) {
                winChance += CHARM_WIN_BONUS;
                userData.inventory["lucky_charm"] -= 1;
                cloverMessage = `\n🍀 **Đã sử dụng Bùa may mắn (${charmCount - 1} lần sử dụng còn lại):** Cơ hội thắng của bạn đã được tăng cường!`;
                usedCharm = true;
            }

            const win = Math.random() < winChance;
            let cashChange = 0;
            let resultEmbed;

            if (win) {
                const amountWon = Math.floor(betAmount * PAYOUT_MULTIPLIER);
cashChange = amountWon;

                resultEmbed = successEmbed(
                    "🎉 Bạn đã thắng!",
                    `Bạn đã đánh cược thành công và biến cược **$${betAmount.toLocaleString()}** của bạn thành **$${amountWon.toLocaleString()}**!${cloverMessage}`,
                );
            } else {
cashChange = -betAmount;

                resultEmbed = errorEmbed(
                    "💔 Bạn đã thua...",
                    `Xúc xắc lăn chống lại bạn. Bạn đã mất cược **$${betAmount.toLocaleString()}** của mình.`,
                );
            }

            userData.wallet = (userData.wallet || 0) + cashChange;
userData.lastGamble = now;

            await setEconomyData(client, guildId, userId, userData);

            const newCash = userData.wallet;

            resultEmbed.addFields({
                name: "💵 Số dư tiền mặt mới",
                value: `$${newCash.toLocaleString()}`,
                inline: true,
            });

            if (usedClover) {
                resultEmbed.setFooter({
                    text: `Bạn còn ${userData.inventory["lucky_clover"]} Cỏ bốn lá May mắn. Cơ hội thắng là ${Math.round(winChance * 100)}%.`,
                });
            } else if (usedCharm) {
                resultEmbed.setFooter({
                    text: `Bạn còn ${userData.inventory["lucky_charm"]} lần sử dụng Bùa may mắn. Cơ hội thắng là ${Math.round(winChance * 100)}%.`,
                });
            } else {
                resultEmbed.setFooter({
                    text: `Đánh cược tiếp theo có sẵn sau 5 phút. Cơ hội thắng cơ bản: ${Math.round(BASE_WIN_CHANCE * 100)}%.`,
                });
            }

            await InteractionHelper.safeEditReply(interaction, { embeds: [resultEmbed] });
    }, { command: 'gamble' })
};




