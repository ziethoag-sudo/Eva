import { MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { setBirthday } from '../../../services/birthdayService.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
export default {
    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const month = interaction.options.getInteger("thang");
            const day = interaction.options.getInteger("ngay");
            const userId = interaction.user.id;
            const guildId = interaction.guildId;

            
            const result = await setBirthday(client, guildId, userId, month, day);
            
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed(
                    `Sinh nhật của bạn đã được thiết lập thành **${result.data.monthName} ${result.data.day}**!`,
                    "Đã thiết lập sinh nhật! 🎂"
                )]
            });
        } catch (error) {
            logger.error("Lỗi thực thi lệnh thiết lập sinh nhật", {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'sinhnhat_thietlap'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'sinhnhat_thietlap',
                source: 'birthday_set_module'
            });
        }
    }
};



