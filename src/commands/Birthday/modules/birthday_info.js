import { MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { getUserBirthday } from '../../../services/birthdayService.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
export default {
    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const targetUser = interaction.options.getUser("nguoi") || interaction.user;
            const userId = targetUser.id;
            const guildId = interaction.guildId;

            
            const birthdayData = await getUserBirthday(client, guildId, userId);

            if (!birthdayData) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [createEmbed({
                        title: '❌ Không tìm thấy sinh nhật',
                        description: targetUser.id === interaction.user.id 
                            ? "Bạn chưa thiết lập sinh nhật. Dùng `/sinhnhat thietlap` để thêm!"
                            : `${targetUser.username} chưa thiết lập sinh nhật.`,
                        color: 'error'
                    })]
                });
            }
            
            const embed = createEmbed({
                title: "🎂 Thông tin Sinh nhật",
                description: `**Ngày:** ${birthdayData.monthName} ${birthdayData.day}\n**Người dùng:** ${targetUser.toString()}`,
                color: 'info',
                footer: targetUser.id === interaction.user.id ? "Sinh nhật của bạn" : `Sinh nhật của ${targetUser.username}`
            });
            
            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            
            logger.info('Thông tin sinh nhật đã được truy xuất thành công', {
                userId: interaction.user.id,
                targetUserId: targetUser.id,
                guildId,
                commandName: 'sinhnhat_thongtin'
            });
        } catch (error) {
            logger.error("Lỗi thực thi lệnh thông tin sinh nhật", {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'sinhnhat_thongtin'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'sinhnhat_thongtin',
                source: 'birthday_info_module'
            });
        }
    }
};



