import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed } from "../../utils/embeds.js";
import {
    createSelectMenu,
} from "../../utils/components.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORY_SELECT_ID = "help-category-select";
const ALL_COMMANDS_ID = "help-all-commands";
const BUG_REPORT_BUTTON_ID = "help-bug-report";
const HELP_MENU_TIMEOUT_MS = 5 * 60 * 1000;

const CATEGORY_ICONS = {
    Core: "ℹ️",
    Moderation: "🛡️",
    Economy: "💰",
    Fun: "🎮",
    Leveling: "📊",
    Utility: "🔧",
    Ticket: "🎫",
    Welcome: "👋",
    Giveaway: "🎉",
    Counter: "🔢",
    Tools: "🛠️",
    Search: "🔍",
    Reaction_Roles: "🎭",
    Community: "👥",
    Birthday: "🎂",
    Config: "⚙️",
};

const CATEGORY_TRANSLATIONS = {
    Core: "Cốt lõi",
    Moderation: "Kiểm duyệt",
    Economy: "Kinh tế",
    Fun: "Vui vẻ",
    Leveling: "Cấp độ",
    Utility: "Tiện ích",
    Ticket: "Vé",
    Welcome: "Chào mừng",
    Giveaway: "Quà tặng",
    Counter: "Đếm",
    Tools: "Công cụ",
    Search: "Tìm kiếm",
    Reaction_Roles: "Vai trò Phản ứng",
    Community: "Cộng đồng",
    Birthday: "Sinh nhật",
    Config: "Cấu hình",
};





export async function createInitialHelpMenu(client) {
    const commandsPath = path.join(__dirname, "../../commands");
    const categoryDirs = (
        await fs.readdir(commandsPath, { withFileTypes: true })
    )
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name)
        .sort();

    const options = [
        {
            label: "📋 Tất cả Lệnh",
            description: "Xem tất cả lệnh có sẵn với phân trang",
            value: ALL_COMMANDS_ID,
        },
        ...categoryDirs.map((category) => {
            const categoryName =
                category.charAt(0).toUpperCase() +
                category.slice(1).toLowerCase();
            const translatedName = CATEGORY_TRANSLATIONS[categoryName] || categoryName;
            const icon = CATEGORY_ICONS[categoryName] || "🔍";
            return {
                label: `${icon} ${translatedName}`,
                description: `Xem lệnh trong danh mục ${translatedName}`,
                value: category,
            };
        }),
    ];

    const botName = client?.user?.username || "Bot";
    const embed = createEmbed({ 
        title: `🤖 Trung tâm Trợ giúp ${botName}`,
        description: "Người bạn đồng hành Discord tất cả trong một cho kiểm duyệt, kinh tế, vui vẻ và quản lý máy chủ.",
        color: 'primary'
    });

    embed.addFields(
        {
            name: "🛡️ **Kiểm duyệt**",
            value: "Kiểm duyệt máy chủ, quản lý người dùng và công cụ thực thi",
            inline: true
        },
        {
            name: "💰 **Kinh tế**",
            value: "Hệ thống tiền tệ, cửa hàng và kinh tế ảo",
            inline: true
        },
        {
            name: "🎮 **Vui vẻ**",
            value: "Trò chơi, giải trí và lệnh tương tác",
            inline: true
        },
        {
            name: "📊 **Cấp độ**",
            value: "Cấp độ người dùng, hệ thống XP và theo dõi tiến bộ",
            inline: true
        },
        {
            name: "🎫 **Vé**",
            value: "Hệ thống vé hỗ trợ cho quản lý máy chủ",
            inline: true
        },
        {
            name: "🎉 **Quà tặng**",
            value: "Quản lý và phân phối quà tặng tự động",
            inline: true
        },
        {
            name: "👋 **Chào mừng**",
            value: "Tin nhắn chào mừng thành viên và giới thiệu",
            inline: true
        },
        {
            name: "🎂 **Sinh nhật**",
            value: "Theo dõi sinh nhật và tính năng kỷ niệm",
            inline: true
        },
        {
            name: "👥 **Cộng đồng**",
            value: "Công cụ cộng đồng, ứng dụng và tương tác thành viên",
            inline: true
        },
        {
            name: "⚙️ **Cấu hình**",
            value: "Lệnh quản lý cấu hình máy chủ và bot",
            inline: true
        },
        {
            name: "🔢 **Đếm**",
            value: "Thiết lập kênh đếm trực tiếp và điều khiển đếm",
            inline: true
        },
        {
            name: "🎙️ **Tham gia để Tạo**",
            value: "Tạo và quản lý kênh thoại động",
            inline: true
        },
        {
            name: "🎭 **Vai trò Phản ứng**",
            value: "Vai trò tự gán bằng hệ thống vai trò phản ứng",
            inline: true
        },
        {
            name: "✅ **Xác minh**",
            value: "Quy trình xác minh thành viên và cổng truy cập",
            inline: true
        },
        {
            name: "🔧 **Tiện ích**",
            value: "Công cụ hữu ích và tiện ích máy chủ",
            inline: true
        }
    );

    embed.setFooter({ 
        text: "Gok" 
    });
    embed.setTimestamp();

    const bugReportButton = new ButtonBuilder()
        .setCustomId(BUG_REPORT_BUTTON_ID)
        .setLabel("Báo lỗi")
        .setStyle(ButtonStyle.Danger);

    const supportButton = new ButtonBuilder()
        .setLabel("Server discord")
        .setURL("https://discord.gg/bVzhwtgTc")
        .setStyle(ButtonStyle.Link);

    const touchpointButton = new ButtonBuilder()
        .setLabel("Learn Gok")
        .setURL("https://www.facebook.com/ziet.hoag")
        .setStyle(ButtonStyle.Link);

    const selectRow = createSelectMenu(
        CATEGORY_SELECT_ID,
        "Chọn để xem các lệnh",
        options,
    );

    const buttonRow = new ActionRowBuilder().addComponents([
        bugReportButton,
        supportButton,
        touchpointButton,
    ]);

    return {
        embeds: [embed],
        components: [buttonRow, selectRow],
    };
}

export default {
    data: new SlashCommandBuilder()
        .setName("trogiup")
        .setDescription("Hiển thị menu trợ giúp với tất cả lệnh có sẵn"),

    async execute(interaction, guildConfig, client) {
        
        const { MessageFlags } = await import('discord.js');
        await InteractionHelper.safeDefer(interaction);
        
        const { embeds, components } = await createInitialHelpMenu(client);

        await InteractionHelper.safeEditReply(interaction, {
            embeds,
            components,
        });

        setTimeout(async () => {
            try {
                const closedEmbed = createEmbed({
                    title: "Menu trợ giúp đã đóng",
                    description: "Menu trợ giúp đã được đóng, sử dụng /help lại.",
                    color: "secondary",
                });

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [closedEmbed],
                    components: [],
                });
            } catch (error) {
                
            }
        }, HELP_MENU_TIMEOUT_MS);
    },
};


