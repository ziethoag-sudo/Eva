import { SlashCommandBuilder, MessageFlags, ChannelType } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

import birthdaySet from './modules/birthday_set.js';
import birthdayInfo from './modules/birthday_info.js';
import birthdayList from './modules/birthday_list.js';
import birthdayRemove from './modules/birthday_remove.js';
import nextBirthdays from './modules/next_birthdays.js';
import birthdaySetchannel from './modules/birthday_setchannel.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName('sinhnhat')
        .setDescription('Lệnh hệ thống sinh nhật')
        .addSubcommand(subcommand =>
            subcommand
                .setName('thietlap')
                .setDescription('Thiết lập sinh nhật của bạn')
                .addIntegerOption(option =>
                    option
                        .setName('thang')
                        .setDescription('Tháng sinh (1-12)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(12)
                )
                .addIntegerOption(option =>
                    option
                        .setName('ngay')
                        .setDescription('Ngày sinh (1-31)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(31)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('thongtin')
                .setDescription('Xem thông tin sinh nhật')
                .addUserOption(option =>
                    option
                        .setName('nguoi')
                        .setDescription('Người dùng cần kiểm tra sinh nhật')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('danhsach')
                .setDescription('Liệt kê tất cả sinh nhật trong máy chủ')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('xoa')
                .setDescription('Xóa sinh nhật của bạn')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('sapto')
                .setDescription('Hiển thị sinh nhật sắp tới')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('datkenh')
                .setDescription('Đặt hoặc tắt kênh thông báo sinh nhật. (Yêu cầu Quản lý máy chủ)')
                .addChannelOption(option =>
                    option
                        .setName('kenh')
                        .setDescription('Kênh văn bản để thông báo. Để trống để tắt.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
        ),

    async execute(interaction, config, client) {
        try {
            const subcommand = interaction.options.getSubcommand();
            
            switch (subcommand) {
                case 'thietlap':
                    return await birthdaySet.execute(interaction, config, client);
                case 'thongtin':
                    return await birthdayInfo.execute(interaction, config, client);
                case 'danhsach':
                    return await birthdayList.execute(interaction, config, client);
                case 'xoa':
                    return await birthdayRemove.execute(interaction, config, client);
                case 'sapto':
                    return await nextBirthdays.execute(interaction, config, client);
                case 'datkenh':
                    return await birthdaySetchannel.execute(interaction, config, client);
                default:
                    return InteractionHelper.safeReply(interaction, {
                        embeds: [errorEmbed('Lỗi', 'Lệnh con không xác định')],
                        flags: MessageFlags.Ephemeral
                    });
            }
        } catch (error) {
            logger.error('Birthday command execution failed', {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'sinhnhat',
                subcommand: interaction.options.getSubcommand()
            });
            await handleInteractionError(interaction, error, {
                commandName: 'sinhnhat',
                source: 'birthday_command'
            });
        }
    }
};


