// Hello!
// This bot is being dev'd for the Discord server Hentai Moutarde at https://discord.gg/xX33Vkr
// It is an international Discord revolving around hentai (and more)
// If you plan on stealing this, please kindly go fuck yourself.

// Have any questions ? Go ask Koreos#7227 or PopahGlo#3995 over at HM!

const fs = require("fs");

// Launch the webhook listener
const secrets = require("./secrets.json");

const WHL = require("./webHookListener.js");

WHL.callback = function() {
    try {
        bot.channels.get("311496070074990593").send("I have just updated!");
    } catch (error) {
        console.warn("Unable to alert on discord, just updated.");
    }
};

WHL.init(7227, secrets.webHookSecret);

// Discord library and client
const Discord = require("discord.js");
const bot = new Discord.Client();

// Bot configuration
let config, msgCount;
let hentaiMoutarde;

// Useful constants
const sec = 1000,
    min = 60 * sec,
    hour = 60 * min;

// Bot managers
const spamManager = require("./spammanager.js");
let SM = new spamManager.Manager(30000);

const slowModeManager = require("./slowmodemanager.js");
let slowMode = new slowModeManager.Manager();

// CONFIG

function loadJson(...names) {
    let arr = [];
    for (let name of names) {
        arr.push(JSON.parse(fs.readFileSync(name + ".json").toString()));
    }
    return (arr.length === 1 ? arr[0] : arr);
}

function saveJson(content, name, beautify = false) {
    let contentJson = (beautify ?
        JSON.stringify(content, null, 4) :
        JSON.stringify(content));
    fs.writeFileSync(name + ".json", contentJson, "utf-8");
}

// UTILITY

String.prototype.charTally = function charTally() { // Count the number of occurrences of each character in the string.
    return this.split("").reduce((acc, char) => {
        acc[char] = (acc[char] || 0) + 1;
        return acc;
    }, {});
};

function today() { // Returns today's date
    let d = new Date();
    return d.getDate() + "-" + (d.getMonth() + 1) + "-" + d.getFullYear();
}

// ROLES

// Test if member has one of the roles passed
const memberRole = (member, ...roles) => member.roles.find(role => roles.includes(role.name));

// Get a role from a guild
const getRole = (name) => hentaiMoutarde.roles.find(val => val.name === name);

function cleanUpColorRoles() {
    hentaiMoutarde.roles.filter(role => role.name.includes("dncolor") && role.members.size === 0)
        .forEach(role => role.delete());
}

function warnMember(member) { // Warn a member and mute him if necessary
    console.log(`warning user ${member.user.username}`);

    if (!config.warns[member.toString()]) { // Is he already warned?
        config.warns[member.toString()] = 1; // If not, add him to the list of warned
    } else {
        config.warns[member.toString()] += 1;
        if (config.warns[member.toString()] >= config.maxWarns) {
            member.addRole(getRole("Muted"), "3rd warning")
                .catch(console.error);
            delete config.warns[member.toString()];
        }
    }
    saveJson(config, "config", true);
}

// Message count (Guide frénétique)
function updateMsgCount(member) {
    // Update date and add/remove day if new day
    if (today() !== msgCount.date) {
        msgCount.date = today();

        for (let user in msgCount.users) {
            msgCount.users[user].counts.pop();
            msgCount.users[user].counts.unshift(0);

            // No messages in a month, delete entry
            if (msgCount.users[user].counts.reduce((n, a) => a + n, 0) === 0) {
                delete msgCount.users[user].counts;
            }
        }
    }

    // If user doesn't have an entry
    if (msgCount.users[member.toString()] == null) {
        msgCount.users[member.toString()] = {
            counts: new Array(config.daysMsgCount).fill(0),
            lastMsg: Date.now()
        };
    } else {
        msgCount.users[member.toString()].lastMsg = Date.now();
    }

    // Add message to count and save
    msgCount.users[member.toString()].counts[0]++;

    saveJson(msgCount, "msgCount");

    // Remove/add role with total count
    let totalCount = msgCount.users[member.toString()].counts.reduce((n, a) => a + n, 0);

    if (totalCount >= config.minMsgCount && !memberRole(member, "Guide frénétique"))
        member.addRole(getRole("Guide frénétique"));
    else if (totalCount < config.minMsgCount && memberRole(member, "Guide frénétique"))
        member.removeRole(getRole("Guide frénétique"));
}

function topUsers() {
    return Object.entries(msgCount.users)
        .map(e => [e[0], e[1].counts.reduce((a, b) => a + b, 0)])
        .sort((e1, e2) => e2[1] - e1[1]);
}

let bumpChannel;

function dlmBump() {
    if (bumpChannel) {
        bumpChannel.send("dlm!bump");
        setTimeout(dlmBump, (9 * hour) + (Math.random() * (5 * min)));
    }
}

// Runs on bot start
bot.once("ready", () => {
    console.log(`Bot started ! ${bot.users.size} users.`);
    bot.user.setActivity("twitter.com/hentaimoutarde");

    [config, msgCount] = loadJson("config", "msgCount");

    hentaiMoutarde = bot.guilds.get(config.server);
    bumpChannel = bot.channels.get("311496070074990593");
    dlmBump();
});

// Message handling
bot.on("message", message => {
    // Ignore bot commands and private messages
    const {author, member, channel, content} = message;

    if (author.bot || channel.type !== "text") return;

    const ok = () => message.react("👌");

    if (!config.ignoredCount.includes(channel.name)
        && (msgCount.users[member.toString()] == null
            || Date.now() >= msgCount.users[member.toString()].lastMsg + config.msgDelay)) {
        updateMsgCount(member);
    }

    // User commands
    if (content.startsWith(config.prefixU)) {
        let commandAndArgs = content.substring(config.prefixU.length).split(" "); // Split the command and args
        let command = commandAndArgs[0];  // Alias to go faster

        if (command === "color") {
            if (memberRole(member, "Donateur")) {  // Si on a le role donateur
                if (commandAndArgs.length === 2) { // I want exactly 1 argument
                    let role = member.roles.find(val => val.name.includes("dncolor"));  // Find the user's color role if there is one

                    if (role) {
                        member.removeRole(role)
                            .catch(console.error);
                    }

                    if (commandAndArgs[1] === "reset") { // Reset is not a color, allow people to just remove it
                        cleanUpColorRoles();
                    } else {
                        role = getRole("dncolor" + commandAndArgs[1]);

                        if (role) {
                            member.addRole(role);
                        } else {
                            hentaiMoutarde.createRole({
                                    name: "dncolor" + commandAndArgs[1],
                                    color: commandAndArgs[1],
                                    hoist: false,
                                    position: memberRole(member, "Donateur").position + 1, // 1 au dessus du role donateur
                                    mentionable: false
                                })
                                .then(role => member.addRole(role)
                                    .then(() => cleanUpColorRoles())
                                    .catch(console.error))
                                .catch(console.error);
                        }
                        ok();
                    }
                } else {  // Le mec a le droit mais il sait pas faire
                    message.reply("exemple: `color #FF4200`");
                }
            } else {  // Le mec a pas le droit
                message.reply("vous devez etre donateur pour utiliser cette commande.");
            }
            return;

        } else if (command === "top") {
            // Get page number
            let page = commandAndArgs[1] != null && commandAndArgs[1].match(/^[0-9]+$/) ?
                parseInt(commandAndArgs[1]) : 1;

            let pageN = (page - 1) * 10;
            let top = topUsers().slice(pageN, pageN + 10);

            if (top.length > 0) {
                // Reduce array to build string with top
                let topStr = top.reduce((s, e, i) => {
                    let user = bot.users.get(e[0].match(/[0-9]+/)[0]);
                    return s + "\n" +
                        ("#" + (i + pageN + 1)).padEnd(5) + " " +
                        (user != null ? user.username.padEnd(18).slice(0, 18) : "[membre inconnu]  ") + " " +
                        e[1];
                }, "");

                channel.send("```js" + topStr + "```");
            } else {
                channel.send(`Personne dans le top à la page ${page}`);
            }
            return;

        } else if (command === "score") {
            let user = (message.mentions.members.size > 0 ? message.mentions.members.array()[0] : member);
            let usrData = msgCount.users[user];

            if (usrData != null) {
                let rank = topUsers().map(e => e[0]).indexOf(user.toString()) + 1,
                    tot = usrData.counts.reduce((a, b) => a + b, 0),
                    avg = Math.round(tot / usrData.counts.length * 100) / 100,
                    max = usrData.counts.reduce((a, b) => (a > b ? a : b), 0);

                channel.send({
                    embed: new Discord.RichEmbed()
                        .setColor(16777067)
                        .setTitle(`Score de ${user.user.tag} (${config.daysMsgCount} jours)`)
                        .setDescription(`Rang d'utilisateur : **#${rank}**\nNombre total de messages : **${tot}**\nMoyenne de messages par jour : **${avg}**\nMaximum de messages en un jour : **${max}**`)
                });
            } else {
                channel.send(`Pas de données pour l'utilisateur ${user.user.tag}`);
            }

            return;

        } else if (command === "help") {
            let p = "• `" + config.prefixU;
            channel.send({
                embed: new Discord.RichEmbed()
                    .setColor(16777067)
                    .addField("Commandes utilisateur",
                        p + "top [page]` : Affiche le top de score (nombre de message) sur les " + config.daysMsgCount + " derniers jours.\n" +
                        p + "score [mention]` : Affiche les infos relatives au score d'un utilisateur (vous par défaut).")
                    .addField("Commandes Donateur",
                        p + "color <code_couleur/reset>` : Change la couleur de votre nom au code couleur choisi. (exemple: `" + config.prefixU + "color #FF4200`)")
            });
            return;
        }
    }

    // Mod commands
    if (content.startsWith(config.prefixM)) {
        if (memberRole(member, "Généraux", "Salade de fruits")) {
            let commandAndArgs = content.substring(config.prefixM.length).split(" "); // Split the command and args
            let command = commandAndArgs[0];  // Alias to go faster

            if (command === "warn") { // FIXME
                message.mentions.members.forEach(warnMember);
                ok();
                return;

            } else if (command === "spamtimeout") {
                try {
                    SM.changeTimeout(commandAndArgs[1]);
                    ok();
                } catch (e) {
                    message.reply("Erreur: " + e);
                }
                return;

            } else if (command === "slowmode") {
                try {
                    if (commandAndArgs[1] === "0") {
                        slowMode.removeSlowMode(channel);
                        ok();

                    } else if (commandAndArgs[1] === "help") {
                        message.reply("usage: slowmode <time>[h/m/s/ms] (default: seconds)\nexample: slowmode 24h\nremove with slowmode 0");

                    } else {
                        if (commandAndArgs[1].endsWith("h"))
                            slowMode.addSlowMode(channel, commandAndArgs[1].slice(0, -1) * hour);
                        else if (commandAndArgs[1].endsWith("m"))
                            slowMode.addSlowMode(channel, commandAndArgs[1].slice(0, -1) * min);
                        else if (commandAndArgs[1].endsWith("s"))
                            slowMode.addSlowMode(channel, commandAndArgs[1].slice(0, -1) * sec);
                        else if (commandAndArgs[1].endsWith("ms"))
                            slowMode.addSlowMode(channel, commandAndArgs[1].slice(0, -2));
                        else
                            slowMode.addSlowMode(channel, commandAndArgs[1] * sec);

                        ok();
                    }
                } catch (e) {
                    message.reply("Erreur: " + e);
                }
                return;

            } else if (command === "setprotectedname") {
                if (commandAndArgs[1].startsWith("<@")) {
                    config.protectedNames.set(content.slice(21 + commandAndArgs[1].length), commandAndArgs[1].slice(2, -1));
                    saveJson(config, "config", true);
                    ok();
                } else {
                    message.reply("usage: setprotectedname <@user> <name>");
                }
                return;

            } else if (command === "setgame") {
                bot.user.setActivity(content.substring(11));
                ok();
                return;

            } else if (command === "maxwarns") {
                config.maxWarns = commandAndArgs[1];
                saveJson(config, "config", true);
                ok();
                return;

            } else if (command === "help") {
                let p = "• `" + config.prefixM;
                channel.send({
                    embed: new Discord.RichEmbed()
                        .setColor(16777067)
                        .addField("Commandes modérateur:",
                            p + "warn <@user> [reason]` : Ajoute un warning a user. Reason est inutile et sert juste a faire peur.\n" +
                            p + "spamtimeout <temps en ms>` : Change la duree pendant laquelle deux messages identiques ne peuvent pas etre postés (default: 30s)\n" +
                            p + "slowmode <temps>[h/m/s/ms]` (default: s) : Crée ou modifie un slowmode dans le channel actuel.\n" +
                            p + "setprotectedname <@user> <name>` : Réserve un nom pour user. Plusieurs noms par user possibles.\n" +
                            p + "setgame <game>` : Change la phrase de statut du bot.\n" +
                            p + "maxwarnings <number>` : Les utilisateurs seront mute apres number warns. (default 3)\n")
                });
                return;
            }
        }

        if (config.devs.includes(author.id)) {
            if (content === "hm reload") {
                config = loadJson("config");
                channel.send("Reloaded config successfully.");
                return;
            } else if (content.startsWith("hm autogoulag ")) {
                config.autoGoulag = content.substring(14);
                saveJson(config, "config", true);
                ok();
                return;
            } else if (content === "hm config") {
                author.send("```json\n" + JSON.stringify(config, null, 4) + "```");
                ok();
                return;
            } else if (content.startsWith("hm simon ")) {
                channel.send(content.substring(9));
                return;
            } else if (content === "hm update") {
                channel.send("Updating...");
                WHL.update();
                return;
            }
        }
    }

    // Deleting "@everyone" made by random people
    if (content.includes("@everyone")
        && !memberRole(member, "Généraux", "Salade de fruits")) {
        warnMember(member);
        channel.send(member.toString() + "\n" +
            "Le @​everyone est réservé aux admins ! N'essayez pas de l'utiliser.\n" +
            "*@​everyone is reserved for admins! Don't try to use it.*");
        message.delete()
            .catch(console.error);
    }

    let tally = content.charTally();
    let highestCount = Math.max(...Object.values(tally));

    if (!config.ignoredWarn.includes(channel.name) && !memberRole(member, "Généraux")) {
        let warn = "";

        if (slowMode.isPrevented(message)) {
            author.send("Le channel dans lequel vous essayez de parler est en slowmode, merci de patienter avant de poster à nouveau.")
                .catch(console.error);
            message.delete()
                .catch(console.error);

        } else if (content.length >= 1000) // Degager les messages de 1000+ chars
            warn = "Merci de limiter vos pavés ! Utilisez #spam-hell-cancer pour vos copypastas. (warn)\n" +
                "*Please avoid walls of text! Use #spam-hell-cancer for copypastas. (warn)*";

        else if (message.attachments.size === 0 && SM.isSpam(content))
            warn = "Prévention anti-spam - ne vous répétez pas. (warn)\n" +
                "*Spam prevention - don't repeat yourself. (warn)*";

        else if (content.length >= 20 && (highestCount + 1) / (message.content.length + 2) > 0.75)
            warn = "Prévention anti-flood - ne vous répétez pas. (warn)\n" +
                "*Flood prevention - don't repeat yourself. (warn)*";

        if (warn !== "") {
            warnMember(member);
            channel.send(member.toString() + "\n" + warn);
            message.delete()
                .catch(console.error);
        }
    }
});

bot.on("guildMemberUpdate", (oldMember, newMember) => {
    if (newMember.nickname && oldMember.nickname !== newMember.nickname
        && config.protectedNames[newMember.nickname.toLowerCase()]
        && config.protectedNames[newMember.nickname.toLowerCase()] !== newMember.id) {
        warnMember(newMember);
        newMember.setNickname("LE FAUX " + newMember.nickname, "Protected name.")
            .catch(console.error);
    }
});

bot.on("guildMemberAdd", member => {
    if (member.user.username.match(new RegExp(config.autoGoulag))) {
        member.addRole(getRole("GOULAG"));
        member.send("Vous avez été mute sur le serveur Hentai Moutarde car nous avons des chances de penser que vous êtes un bot.\n" +
            "Si vous pensez qu'il s'agit d'une erreur, merci de contacter un membre avec le role **Généraux** ou **Salade de fruit**.\n" +
            "\n*You were muted on the Hentai Moutarde server, as there is a chance you are a bot.\n" +
            "If you think this is an error, please contact a member with the **Généraux** or **Salade de fruit** role.*");
    }
});


bot.login(secrets.token); //Yes.
