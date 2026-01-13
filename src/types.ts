import { AIDrawUnit } from "./ai";
import { KyselyDB } from "./db";
import { RinMessage } from "./rin-model";
import { Storage } from "./storage";

type AskResult = {
	success: true,
	answer: string,
	messages: any,
	tokenUsage: number
} | {
	success: false;
	code: number;
	message: string;
};

type ChainLink = [user: boolean, text: string, image?: string];
export type Ask = (
	key: string,
	dialog: ChainLink[],
	systemPrompt: string | null,
	models: string[],
	maxTokens?: number
) => Promise<AskResult>;

export type Rinputs = {
	message: RinMessage,
	tgToken: string,
	storage: Storage,
	aiKey: string,
	drawAi: AIDrawUnit,
	dbConnector: () => KyselyDB
}
