import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const SLUT_COOLDOWN = 45 * 60 * 1000;

const SLUT_ACTIVITIES = [
    { name: "Cam Stream", min: 120, max: 450, risk: 0.2 },
    { name: "Private Dance Session", min: 220, max: 700, risk: 0.25 },
    { name: "After-Hours Club Host", min: 320, max: 900, risk: 0.3 },
    { name: "VIP Companion Booking", min: 550, max: 1400, risk: 0.35 },
    { name: "Exclusive Livestream", min: 850, max: 2200, risk: 0.4 },
];

const POSITIVE_OUTCOMES = [
    "Luồng của bạn bùng nổ và tiền boa đổ về.",
    "Đặt chỗ VIP trả cao hơn mức trung bình.",
    "Ca làm sau giờ của bạn đông đúc và có lợi nhuận.",
    "Yêu cầu cao cấp được thực hiện và thanh toán của bạn tăng vọt.",
];

const FINE_OUTCOMES = [
    "Bảo vệ địa điểm đã phạt tuân thủ.",
    "Đánh giá kiểm duyệt kích hoạt phí nền tảng.",
    "Bạn bị đánh dấu và phải trả phạt.",
];

const ROBBED_OUTCOMES = [
    "Người mua giả hoàn tiền xóa một phần thu nhập của bạn.",
    "Đặt chỗ lừa đảo làm sạch một phần tiền mặt của bạn.",
    "Bạn bị mắc lừa bởi tài khoản gian lận và mất tiền.",
];

const LOSS_OUTCOMES = [
    "Bộ phim thất bại và bạn phải chịu chi phí vận hành.",
    "Bạn đốt ngân sách cho chuẩn bị và không có lợi nhuận.",
    "Ca làm đi chệch hướng và để lại bạn trong tình trạng thua lỗ.",
];

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(items) {
    return items[Math.floor(Math.random() * items.length)];
}

function resolveOutcome(activity, wallet) {
    const successChance = Math.max(0.35, 0.55 - activity.risk * 0.2);
    const fineChance = 0.22;
    const robbedChance = 0.2;
    const roll = Math.random();

    if (roll < successChance) {
        const amount = randomInt(activity.min, activity.max);
        return {
            type: 'payout',
            delta: amount,
            message: randomChoice(POSITIVE_OUTCOMES),
            title: `💰 ${activity.name} - Thanh toán`
        };
    }

    const remainingAfterSuccess = roll - successChance;

    if (remainingAfterSuccess < fineChance) {
        const maxFine = Math.min(wallet, Math.max(150, Math.floor(activity.max * 0.4)));
        const minFine = Math.min(maxFine, Math.max(50, Math.floor(activity.min * 0.2)));
        const amount = maxFine > 0 ? randomInt(minFine, maxFine) : 0;
        return {
            type: 'fine',
            delta: -amount,
            message: randomChoice(FINE_OUTCOMES),
            title: `🚨 ${activity.name} - Bị phạt`
        };
    }

    if (remainingAfterSuccess < fineChance + robbedChance) {
        const maxRobbed = Math.min(wallet, Math.max(200, Math.floor(wallet * 0.35)));
        const minRobbed = Math.min(maxRobbed, Math.max(75, Math.floor(wallet * 0.1)));
        const amount = maxRobbed > 0 ? randomInt(minRobbed, maxRobbed) : 0;
        return {
            type: 'robbed',
            delta: -amount,
            message: randomChoice(ROBBED_OUTCOMES),
            title: `🕵️ ${activity.name} - Bị cướp`
        };
    }

    const maxLoss = Math.min(wallet, Math.max(100, Math.floor(activity.max * 0.3)));
    const minLoss = Math.min(maxLoss, Math.max(40, Math.floor(activity.min * 0.15)));
    const amount = maxLoss > 0 ? randomInt(minLoss, maxLoss) : 0;
    return {
        type: 'loss',
        delta: -amount,
        message: randomChoice(LOSS_OUTCOMES),
        title: `❌ ${activity.name} - Mất mát`
    };
}

export default {
    data: new SlashCommandBuilder()
        .setName('slut')
        .setDescription('Nhận một công việc khiêu khích rủi ro để nhận thanh toán ngẫu nhiên hoặc mất mát'),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

            const userId = interaction.user.id;
            const guildId = interaction.guildId;
            const now = Date.now();

            logger.debug(`[ECONOMY] Slut command started for ${userId}`, { userId, guildId });

            const userData = await getEconomyData(client, guildId, userId);

            if (!userData) {
                throw createError(
                    "Không thể tải dữ liệu kinh tế cho lệnh slut",
                    ErrorTypes.DATABASE,
                    "Không thể tải dữ liệu kinh tế của bạn. Vui lòng thử lại sau.",
                    { userId, guildId }
                );
            }

            const lastSlut = userData.lastSlut || 0;

            if (now - lastSlut < SLUT_COOLDOWN) {
                const remainingTime = lastSlut + SLUT_COOLDOWN - now;
                throw createError(
                    "Thời gian hồi chiêu slut đang hoạt động",
                    ErrorTypes.RATE_LIMIT,
                    `Bạn cần chờ trước khi có thể làm việc lại! Thử lại sau **${Math.ceil(remainingTime / 60000)}** phút.`,
                    { timeRemaining: remainingTime, cooldownType: 'slut' }
                );
            }

            const activity = randomChoice(SLUT_ACTIVITIES);

            const outcome = resolveOutcome(activity, userData.wallet || 0);

            userData.lastSlut = now;
            userData.totalSluts = (userData.totalSluts || 0) + 1;
            userData.totalSlutEarnings = (userData.totalSlutEarnings || 0) + Math.max(0, outcome.delta);
            userData.totalSlutLosses = (userData.totalSlutLosses || 0) + Math.max(0, -outcome.delta);

            if (outcome.type !== 'payout') {
                userData.failedSluts = (userData.failedSluts || 0) + 1;
            }

            userData.wallet = Math.max(0, (userData.wallet || 0) + outcome.delta);

            await setEconomyData(client, guildId, userId, userData);

            logger.info(`[ECONOMY_TRANSACTION] Slut activity resolved`, {
                userId,
                guildId,
                activity: activity.name,
                outcomeType: outcome.type,
                amountDelta: outcome.delta,
                newWallet: userData.wallet,
                timestamp: new Date().toISOString()
            });

            const amountLabel = `${outcome.delta >= 0 ? '+' : '-'}$${Math.abs(outcome.delta).toLocaleString()}`;
            const summaryLines = [
                `${outcome.message}`,
                `💸 **Kết quả ròng:** ${amountLabel}`,
                `💳 **Số dư hiện tại:** $${userData.wallet.toLocaleString()}`,
                `📊 **Tổng phiên:** ${userData.totalSluts}`,
                `💵 **Tổng kiếm được:** $${(userData.totalSlutEarnings || 0).toLocaleString()}`,
                `🧾 **Tổng mất:** $${(userData.totalSlutLosses || 0).toLocaleString()}`
            ];

            const embed = createEmbed({
                title: outcome.title,
                description: summaryLines.join('\n'),
                color: outcome.delta >= 0 ? 'success' : 'error',
                timestamp: true
            });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'slut' })
};





