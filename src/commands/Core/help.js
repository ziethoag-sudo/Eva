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
            label: "📋 All Commands",
            description: "View all available commands with pagination",
            value: ALL_COMMANDS_ID,
        },
        ...categoryDirs.map((category) => {
            const categoryName =
                category.charAt(0).toUpperCase() +
                category.slice(1).toLowerCase();
            const icon = CATEGORY_ICONS[categoryName] || "🔍";
            return {
                label: `${icon} ${categoryName}`,
                description: `View commands in the ${categoryName} category`,
                value: category,
            };
        }),
    ];

    const botName = client?.user?.username || "Bot";
    const embed = createEmbed({ 
        title: `🤖 ${botName} Help Center`,
        description: "Your all-in-one Discord companion for moderation, economy, fun, and server management.",
        color: 'primary'
    });

    embed.addFields(
        {
            name: "🛡️ **Moderation**",
            value: "Kiểm duyệt máy chủ, quản lý người dùng và các công cụ thực thi.",
            inline: true
        },
        {
            name: "💰 **Economy**",
            value: "Hệ thống tiền tệ, cửa hàng và tiền ảo",
            inline: true
        },
        {
            name: "🎮 **Fun**",
            value: "Trò chơi, giải trí và các lệnh tương tác.",
            inline: true
        },
        {
            name: "📊 **Leveling**",
            value: "Kinh nghiệm người dùng, kinh nghiệm hệ thống, theo dõi tiến trình",
            inline: true
        },
        {
            name: "🎫 **Tickets**",
            value: "Hỗ Trợ tạo vé giành cho Staff+",
            inline: true
        },
        {
            name: "🎉 **Giveaways**",
            value: "Tạo giveaway, trao giải",
            inline: true
        },
        {
            name: "👋 **Welcome**",
            value: "Tạo welcome và chỉnh sửa welcome",
            inline: true
        },
        {
            name: "🎂 **Birthdays**",
            value: "Sinh nhật nha >:3",
            inline: true
        },
        {
            name: "👥 **Community**",
            value: "Community tools, applications, and member engagement (Công cụ cộng đồng, đơn ứng dụng và mức độ tương tác của thành viên.) (gg dịch)",
            inline: true
        },
        {
            name: "⚙️ **Config**",
            value: "Chỉnh config server",
            inline: true
        },
        {
            name: "🔢 **Counter**",
            value: "Chỉnh Kênh và Setup Kênh",
            inline: true
        },
        {
            name: "🎙️ **Join to Create**",
            value: "Tạo và quản lý kênh nói (voice)",
            inline: true
        },
        {
            name: "🎭 **Reaction Roles**",
            value: "Tự chỉnh roles, tạo roles, setup roles",
            inline: true
        },
        {
            name: "✅ **Verification**",
            value: "Tạo verify member",
            inline: true
        },
        {
            name: "🔧 **Utilities**",
            value: "Tool cho server",
            inline: true
        }
    );

    embed.setFooter({ 
        text: "Mãi yêu Gok" 
    });
    embed.setTimestamp();

    const bugReportButton = new ButtonBuilder()
        .setCustomId(BUG_REPORT_BUTTON_ID)
        .setLabel("Report Bug")
        .setStyle(ButtonStyle.Danger);

    const supportButton = new ButtonBuilder()
        .setLabel("Support Server")
        .setURL("https://discord.gg/QnWNz2dKCE")
        .setStyle(ButtonStyle.Link);

    const touchpointButton = new ButtonBuilder()
        .setLabel("Learn from Touchpoint")
        .setURL("https://www.youtube.com/@TouchDisc")
        .setStyle(ButtonStyle.Link);

    const selectRow = createSelectMenu(
        CATEGORY_SELECT_ID,
        "Select to view the commands",
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
        .setName("help")
        .setDescription("Displays the help menu with all available commands"),

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
                    title: "Help menu closed",
                    description: "Help menu has been closed, use /help again.",
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


