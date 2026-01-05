type AskResult = {
	success: true,
	answer: string,
	tokenUsage: number
} | {
	success: false;
	code: number;
	message: string;
};

export type Ask = (
	key: string,
	dialog: [user: boolean, text: string][],
	systemPrompt: string,
	models: string[]
) => Promise<AskResult>;