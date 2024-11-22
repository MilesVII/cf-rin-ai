// import axios from "axios";
import { type Storage } from "./storage";
import { tg, pickRandom, sleep, escapeMarkdown } from "./utils";
import seedrandom from "seedrandom";

export type RinMessage = {
	personal: boolean,
	origin: {
		sender: string,
		chat: string,
		text: string
	}
	reply?: {
		to: string,
		message: {
			id: string
		}
	},
	raw: any
};

type SayFunction = (msg: string, reply?: string | boolean, mkdn?: boolean) => Promise<any>;

export async function processRinMessage(message: RinMessage, tgToken: string, storage: Storage) {
	if (message.personal) {
		await tg(
			"sendMessage",
			{
				chat_id: message.origin.chat,
				parse_mode: "MarkdownV2",
				text: `\`\`\`\n${escapeMarkdown(JSON.stringify(message.raw, undefined, "\t"))}\n\`\`\``
			},
			tgToken
		);
	}

	const tgCommons: any = {
		chat_id: message.origin.chat,
	};
	if (message.raw?.message?.message_id)
		tgCommons.reply_to_message_id = message.raw.message.message_id;

	const sayWrapped: SayFunction = (msg, reply, mkdn) => say(tgCommons, tgToken, msg, reply, mkdn);

	await rinModel(message, sayWrapped, storage);
}

function roll(threshold: number) {
	return Math.random() < threshold;
}

async function rinModel(message: RinMessage, say: SayFunction, storage: Storage){
	const prefs = await storage.get("config");
	const state = await storage.get("state");

	const masterSpeaking = prefs.masters.some((m: any) => message.origin.sender == m);
	const autoAppeal = (message.reply?.to == prefs.me);
	const appeals: string[] = prefs.appeals;
	const msgOriginal = message.origin.text;
	const messageText = message.origin.text.toLowerCase();

	function getCommand(message: string, commands: any[]) {
		return commands.find(
			com => com.triggers.some(
				(trig: string) => message.includes(trig)
			)
		);
	}

	if (autoAppeal || appeals.some(a => messageText.startsWith(a))){
		const command = getCommand(messageText, prefs.appealedCommands);
		if (command?.protected && !masterSpeaking) {
			await say(pickRandom(prefs.protectedCommandFailResponse));
			return;
		}

		switch (command?.command) {
			case ("draft_on"): {
				state.drafted = true;
				await storage.set("state", { drafted: true });
				await say(pickRandom(command.responses));
				break;
			}
			case ("draft_off"): {
				state.drafted = false;
				await storage.set("state", { drafted: false });
				await say(pickRandom(command.responses));
				break;
			}
			case ("ah"): {
				await say(pickRandom(prefs.ahs));
				if (roll(prefs.blush.chance)){
					await say(pickRandom(prefs.blush.says));
				}
				break;
			}
			case ("fortune"): {
				const x2 = prefs.auxTriggers.double.some((t: string) => messageText.includes(t));
				const date = new Date().toLocaleDateString();
				const srnd = seedrandom(`${message.origin.sender}-${date}`);

				const [fortunesRaw] = await storage.get("fortunes");
				const fortunes = JSON.parse(fortunesRaw);
				await say(pickRandom(fortunes, srnd()));
				if (x2)
					await say(pickRandom(fortunes, srnd()));
				break;
			}
			case ("potd"): {
				const date = new Date().toLocaleDateString();
				const srnd = seedrandom(date);

				const loader = pickRandom(prefs.potd.loaders, srnd());
				const member = pickRandom(prefs.potd.members, srnd());
				const name = pickRandom(member, srnd());

				for (let loaderLine of loader) {
					if (loaderLine.startsWith(":"))
						await say(
							loaderLine,
							false
						);
					else
						await say(
							escapeMarkdown(loaderLine).replace("\\#", `*${name}*`),
							false,
							true
						);
					await sleep(1000);
				}

				break;
			}
			case ("help"): {
				const appealsHelp = escapeMarkdown(prefs.appealsTemplate)
					.replace("\\#", `*${prefs.appeals.join(", ")}*`);
				const apCommandsHelp = prefs.appealedCommands.filter((c: any) => !c.protected).map((c: any) =>
					escapeMarkdown(prefs.commandHelpTemplate)
						.replace("\\#", `*${c.command}*`)
						.replace("\\#", `*${c.triggers.join(", ")}*`)
						.replace("\\#", `*${c.description ?? "N/A"}*`)
				).join("\n\n");
				const basicTriggers = prefs.autoResponse
					.map((c: any) => 
						c.triggers
							.map((t: string) => `*${escapeMarkdown(t)}*`)
							.join(", ")
					)
					.join(", ");
				const basicTriggersHelp = escapeMarkdown(prefs.responseTemplate).replace("\\#", `${basicTriggers}`);
				const help = `${appealsHelp}\n\n${apCommandsHelp}\n\n${basicTriggersHelp}`;
				
				await say(help, false, true);
				break;
			}
			default: {
				await say(pickRandom(prefs.wats));
				break;
			}
		}
	} else {
		if (state.drafted && masterSpeaking) {
			await say(msgOriginal, message.reply?.to);
		}
		const command = getCommand(messageText, prefs.autoResponse);
		if (command?.chance && !roll(command.chance))
			return;
		if (command) {
			await say(pickRandom(command.responses))
		}
	}
}

function say(options: any, rinToken: string, message: string, reply: string | boolean = true, markdown: boolean = false){
	const commons = {
		...options
	};
	if (reply === false){
		delete commons.reply_to_message_id;
	} else if (reply !== true) {
		commons.reply_to_message_id = reply;
	}
	if (message.startsWith(":sticker:")){
		const id = message.split(":sticker:")[1];
		return tg("sendSticker", {
			...commons,
			sticker: id,
		}, rinToken);
	}
	if (message.startsWith(":audio:")){
		const id = message.split(":audio:")[1];
		return tg("sendAudio", {
			...commons,
			audio: id,
		}, rinToken);
	}
	if (message.startsWith(":photo:")){
		const id = message.split(":photo:")[1];
		return tg("sendPhoto", {
			...commons,
			photo: id,
		}, rinToken);
	}
	if (message.startsWith(":animation:")){
		const id = message.split(":animation:")[1];
		return tg("sendAnimation", {
			...commons,
			animation: id,
		}, rinToken);
	}
	return tg("sendMessage", {
		...commons,
		...(markdown ? {parse_mode: "MarkdownV2"} : {}),
		text: message,
	}, rinToken);
}
