import type { SayInputPayload } from "./rin-model";
import { AIConversations } from "./utils";


type AppealedCommand = {
	triggers: string[],
	command: string,
	protected?: boolean,
	description?: string,
	responses?: string[]
};

type AutoResponse = {
	triggers: string[],
	responses: SayInputPayload[],
};

type POTDGame = {
	loaders: SayInputPayload[][],
	members: string[][]
};

type TarotCard = {
	name: string,
	card: string,
	description: string,
	ru: {
		name: string,
		description: string
	}
};

export type StorageSchema = {
	fortunes: string[],
	config: {
		appeals: string[],
		appealedCommands: AppealedCommand[],
		appealsTemplate: string,
		commandHelpTemplate: string,
		responseTemplate: string,
		autoResponse: AutoResponse[],
		auxTriggers: Record<string, string[]>,
		wats: SayInputPayload[],
		ahs: SayInputPayload[],
		blush: {
			chance: number,
			says: SayInputPayload[]
		},
		masters: string[],
		me: string,
		potd: POTDGame,
		protectedCommandFailResponse: SayInputPayload[]
	},
	state: {
		drafted: boolean
	},
	ai: {
		systemPrompt: string,
		tarotPrompt: string,
		tarotPromptTemplate: string
	},
	aiConversations?: AIConversations,
	tarot: TarotCard[],
}

export type Storage = {
	get: <T extends keyof StorageSchema>(key: T) => Promise<StorageSchema[T]>,
	set: <T extends keyof StorageSchema>(key: T, value: StorageSchema[T]) => Promise<void>
};