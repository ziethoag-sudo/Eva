import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

import dashboard from './modules/logging_dashboard.js';
import setchannel from './modules/logging_setchannel.js';
import filter from './modules/logging_filter.js';

export default {
    data: new SlashCommandBuilder()
        .setName('logging')
        .setDescription('Quản lý ghi nhật ký kiểm tra cho máy chủ này.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('dashboard')
                .setDescription('Mở bảng điều khiển ghi nhật ký tương tác — xem trạng thái và chuyển đổi danh mục sự kiện.'),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setchannel')
                .setDescription('Đặt kênh nhật ký kiểm tra cho máy chủ này.')
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('Kênh văn bản cho nhật ký kiểm tra.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('disable')
                        .setDescription('Đặt thành True để tắt hoàn toàn ghi nhật ký kiểm tra.')
                        .setRequired(false),
                ),
        )
        .addSubcommandGroup((group) =>
            group
                .setName('filter')
                .setDescription('Quản lý danh sách bỏ qua nhật ký (người dùng và kênh để bỏ qua).')
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('add')
                        .setDescription('Thêm người dùng hoặc kênh vào danh sách bỏ qua nhật ký.')
                        .addStringOption((option) =>
                            option
                                .setName('type')
                                .setDescription('Có bỏ qua người dùng hay kênh.')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Người dùng', value: 'user' },
                                    { name: 'Kênh', value: 'channel' },
                                ),
                        )
                        .addStringOption((option) =>
                            option
                                .setName('id')
                                .setDescription('ID của người dùng hoặc kênh để bỏ qua.')
                                .setRequired(true),
                        ),
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('remove')
                        .setDescription('Xóa người dùng hoặc kênh khỏi danh sách bỏ qua nhật ký.')
                        .addStringOption((option) =>
                            option
                                .setName('type')
                                .setDescription('Đây là người dùng hay kênh.')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Người dùng', value: 'user' },
                                    { name: 'Kênh', value: 'channel' },
                                ),
                        )
                        .addStringOption((option) =>
                            option
                                .setName('id')
                                .setDescription('ID của người dùng hoặc kênh để xóa khỏi danh sách bỏ qua.')
                                .setRequired(true),
                        ),
                ),
        ),

    async execute(interaction, config, client) {
        try {
            // setchannel and filter both need a reply deferred before their logic runs
            const subcommandGroup = interaction.options.getSubcommandGroup(false);
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'dashboard') {
                return await dashboard.execute(interaction, config, client);
            }

            await InteractionHelper.safeDefer(interaction);

            if (subcommand === 'setchannel') {
                return await setchannel.execute(interaction, config, client);
            }

            if (subcommandGroup === 'filter') {
                return await filter.execute(interaction, config, client);
            }

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Unknown Subcommand', 'This subcommand is not recognised.')],
            });
        } catch (error) {
            logger.error('logging command error:', error);
            await InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Error', 'An unexpected error occurred.')],
                ephemeral: true,
            }).catch(() => {});
        }
    },
};
