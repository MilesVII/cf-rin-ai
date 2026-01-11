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