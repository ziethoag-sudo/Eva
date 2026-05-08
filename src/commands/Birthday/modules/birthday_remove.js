import { MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { deleteBirthday } from '../../../services/birthdayService.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
export default {
    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const userId = interaction.user.id;
            const guildId = interaction.guildId;

            
            const result = await deleteBirthday(client, guildId, userId);

            if (result.success) {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed(
                        "Sinh nhật của bạn đã được xóa khỏi máy chủ thành công.",
                        "Đã xóa sinh nhật 🗑️"
                    )]
                });
            } else if (result.notFound) {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [createEmbed({
                        title: '❌ Không tìm thấy sinh nhật',
                        description: "Bạn chưa có sinh nhật để xóa.",
                        color: 'error'
                    })]
                });
            }
        } catch (error) {
            logger.error("Lỗi thực thi lệnh xóa sinh nhật", {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'sinhnhat_xoa'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'sinhnhat_xoa',
                source: 'birthday_remove_module'
            });
        }
    }
};



