// import axios from "axios";
import { aiFactory, AIUnit } from "./ai";
import { type Storage } from "./storage";
import { tg, pickRandom, sleep, escapeMarkdown, popRandom } from "./utils";
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

type SayFunction = (msg: string, reply?: string | boolean, mkdn?: boolean) => Promise<Response>;

export async function processRinMessage(message: RinMessage, tgToken: string, storage: Storage, ai: AIUnit) {
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

	await rinModel(message, sayWrapped, storage, ai);
}

function roll(threshold: number) {
	return Math.random() < threshold;
}

async function rinModel(message: RinMessage, say: SayFunction, storage: Storage, ai: AIUnit){
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

				const fortunes = await storage.get("fortunes");
				await say(pickRandom(fortunes, srnd()));
				if (x2)
					await say(pickRandom(fortunes, srnd()));
				break;
			}
			case ("tarot"): {
				const date = new Date().toLocaleDateString();
				const srnd = seedrandom(`${message.origin.sender}-${date}`);

				const deck = await storage.get("tarot");
				const aiPrefs = await storage.get("ai");
				
				const cards = [
					popRandom(deck, srnd()),
					popRandom(deck, srnd()),
					popRandom(deck, srnd())
				];
				
				const pulledCardsNames = cards
					.map(card => card.ru.name)
					.join(", ");
				const aiResponse = ai([{
					role: "user",
					content: aiPrefs.tarotPromptTemplate.replace("#", pulledCardsNames)
				}], aiPrefs.tarotPrompt);

				for (const card of cards) {
					await sleep(1200);
					await say(`:photo:${card.card}`);
				}

				const comment = cards
					.map((card, index) => `${index + 1}\\. *${card.name}* \\| *${card.ru.name}*\n_${escapeMarkdown(card.description)}_`)
					.join("\n\n");

				await say(comment, false, true);
				await say(await aiResponse);

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
				const response = await ai([{
					role: "user",
					content: messageText
				}], prefs.aiSystemPrompt);
				await say(response);
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
