import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { shopItems } from '../../config/shop/items.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { MessageTemplates } from '../../utils/messageTemplates.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const SHOP_ITEMS = shopItems;

export default {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Mua một vật phẩm từ cửa hàng')
        .addStringOption(option =>
            option
                .setName('item_id')
                .setDescription('ID của vật phẩm cần mua')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('quantity')
                .setDescription('Số lượng cần mua (mặc định: 1)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(10)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

            const userId = interaction.user.id;
            const guildId = interaction.guildId;
            const itemId = interaction.options.getString("item_id").toLowerCase();
            const quantity = interaction.options.getInteger("quantity") || 1;

            const item = SHOP_ITEMS.find(i => i.id === itemId);

            if (!item) {
                throw createError(
                    `Không tìm thấy vật phẩm ${itemId}`,
                    ErrorTypes.VALIDATION,
                    `ID vật phẩm \`${itemId}\` không tồn tại trong cửa hàng.`,
                    { itemId }
                );
            }

            if (quantity < 1) {
                throw createError(
                    "Số lượng không hợp lệ",
                    ErrorTypes.VALIDATION,
                    "Bạn phải mua số lượng từ 1 trở lên.",
                    { quantity }
                );
            }

            const totalCost = item.price * quantity;

            const guildConfig = await getGuildConfig(client, guildId);
            const PREMIUM_ROLE_ID = guildConfig.premiumRoleId;

            const userData = await getEconomyData(client, guildId, userId);

            if (userData.wallet < totalCost) {
                throw createError(
                    "Không đủ tiền",
                    ErrorTypes.VALIDATION,
                    `Bạn cần **$${totalCost.toLocaleString()}** để mua ${quantity}x **${item.name}**, nhưng bạn chỉ có **$${userData.wallet.toLocaleString()}** trong ví tiền.`,
                    { required: totalCost, current: userData.wallet, itemId, quantity }
                );
            }

            if (item.type === "role" && itemId === "premium_role") {
                if (!PREMIUM_ROLE_ID) {
                    throw createError(
                        "Vai trò Premium chưa được cấu hình",
                        ErrorTypes.CONFIGURATION,
                        "**Vai trò Cửa hàng Premium** chưa được cấu hình bởi quản trị viên máy chủ.",
                        { itemId }
                    );
                }
                if (interaction.member.roles.cache.has(PREMIUM_ROLE_ID)) {
                    throw createError(
                        "Đã sở hữu vai trò",
                        ErrorTypes.VALIDATION,
                        `Bạn đã có vai trò **${item.name}**.`,
                        { itemId, roleId: PREMIUM_ROLE_ID }
                    );
                }
                if (quantity > 1) {
                    throw createError(
                        "Số lượng không hợp lệ cho vai trò",
                        ErrorTypes.VALIDATION,
                        `Bạn chỉ có thể mua vai trò **${item.name}** một lần.`,
                        { itemId, quantity }
                    );
                }
            }

            userData.wallet -= totalCost;

            let successDescription = `Bạn đã mua thành công ${quantity}x **${item.name}** với giá **$${totalCost.toLocaleString()}**!`;

            if (item.type === "role" && itemId === "premium_role") {
                const member = interaction.member;

                const role = interaction.guild.roles.cache.get(PREMIUM_ROLE_ID);

                if (!role) {
                    throw createError(
                        "Không tìm thấy vai trò",
                        ErrorTypes.CONFIGURATION,
                        "Vai trò premium đã cấu hình không còn tồn tại trong máy chủ này.",
                        { roleId: PREMIUM_ROLE_ID }
                    );
                }

                try {
                    await member.roles.add(
                        role,
                        `Đã mua vai trò: ${item.name}`,
                    );
                    successDescription += `\n\n**👑 Vai trò ${role.toString()} đã được cấp cho bạn!**`;
                } catch (roleError) {
                    userData.wallet += totalCost;
                    await setEconomyData(client, guildId, userId, userData);
                    throw createError(
                        "Gán vai trò thất bại",
                        ErrorTypes.DISCORD_API,
                        "Đã trừ tiền thành công, nhưng không thể cấp vai trò. Tiền mặt của bạn đã được hoàn lại.",
                        { roleId: PREMIUM_ROLE_ID, originalError: roleError.message }
                    );
                }
            } else if (item.type === "upgrade") {
                userData.upgrades[itemId] = true;
                successDescription += `\n\n**✨ Nâng cấp của bạn hiện đang hoạt động!**`;
            } else if (item.type === "consumable") {
                userData.inventory[itemId] =
                    (userData.inventory[itemId] || 0) + quantity;
            }

            await setEconomyData(client, guildId, userId, userData);

            const embed = successEmbed(
                "💰 Mua hàng thành công",
                successDescription,
            ).addFields({
                name: "Số dư mới",
                value: `$${userData.wallet.toLocaleString()}`,
                inline: true,
            });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }, { command: 'buy' })
};





