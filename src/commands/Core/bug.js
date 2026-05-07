import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
export default {
    data: new SlashCommandBuilder()
        .setName("bug")
        .setDescription("Report a bug or issue with the bot"),

    async execute(interaction) {
        const githubButton = new ButtonBuilder()
            .setLabel('?? Report tới discord')
            .setStyle(ButtonStyle.Link)
            .setURL('https://discord.gg/2GMnfpfBt');

        const row = new ActionRowBuilder().addComponents(githubButton);

        const bugReportEmbed = createEmbed({
            title: '?? Báo Lỗi',
            description: 'Bạn tìm thấy lỗi? hãy gửi lỗi qua server discord\n\n' +
            '**Khi báo lỗi vui lòng kèm các thông tin sau:**\n' +
            '• ?? Mô tả chi tiết về lỗi\n' +
            '• ?? Các lỗi xuất hiện từ đâu \n' +
            '• ?? Chụp lại lỗi\n' +
            '• ?? Phiên bảng của bot\n\n' +
            'Nếu bạn báo cáo điều này sẽ khiến chúng tôi khắc phục được những sai sót của bot',
            color: 'error'
        })
            .setTimestamp();

        await InteractionHelper.safeReply(interaction, {
            embeds: [bugReportEmbed],
            components: [row],
        });
    },
};




