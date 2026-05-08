import { MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { getUpcomingBirthdays } from '../../../services/birthdayService.js';
import { deleteBirthday } from '../../../utils/database.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
export default {
    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);
            
            
            const next5 = await getUpcomingBirthdays(client, interaction.guildId, 5);

            if (next5.length === 0) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: '❌ Không tìm thấy sinh nhật',
                            description: 'Chưa có sinh nhật nào được thiết lập trong máy chủ này. Dùng `/sinhnhat thietlap` để thêm sinh nhật!',
                            color: 'error'
                        })
                    ]
                });
            }

            const embed = createEmbed({
                title: '🎂 5 Sinh nhật sắp tới',
                description: `Đây là 5 sinh nhật sắp tới trong ${interaction.guild.name}:`,
                color: 'info'
            });

            let displayIndex = 0;
            for (const birthday of next5) {
                const member = await interaction.guild.members.fetch(birthday.userId).catch(() => null);
                if (!member) {
                    deleteBirthday(client, interaction.guildId, birthday.userId).catch(() => null);
                    continue;
                }
                displayIndex++;

                let timeUntil = '';
                if (birthday.daysUntil === 0) {
                    timeUntil = '🎉 **Hôm nay!**';
                } else if (birthday.daysUntil === 1) {
                    timeUntil = '📅 **Ngày mai!**';
                } else {
                    timeUntil = `Còn ${birthday.daysUntil} ngày`;
                }

                embed.addFields({
                    name: `${displayIndex}. ${member.displayName}`,
                    value: `<@${birthday.userId}>\n📅 **Ngày:** ${birthday.monthName} ${birthday.day}\n⏰ **Thời gian:** ${timeUntil}`,
                    inline: false
                });
            }

            if (displayIndex === 0) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: '❌ Không có sinh nhật sắp tới',
                            description: 'Không tìm thấy sinh nhật sắp tới cho các thành viên hiện tại của máy chủ.',
                            color: 'error'
                        })
                    ]
                });
            }

            embed.setFooter({
                text: 'Dùng /sinhnhat thietlap để thêm sinh nhật của bạn!',
                iconURL: interaction.guild.iconURL()
            });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            
            logger.info('Sinh nhật sắp tới đã được truy xuất thành công', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                upcomingCount: displayIndex,
                commandName: 'sinhnhat_sapto'
            });
        } catch (error) {
            logger.error('Lỗi thực thi lệnh sinh nhật sắp tới', {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'sinhnhat_sapto'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'sinhnhat_sapto',
                source: 'next_birthdays_module'
            });
        }
    }
};



