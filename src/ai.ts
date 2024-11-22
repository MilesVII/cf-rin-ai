
export type AIChatPrompt = {
	role: "user" | "system",
	content: string
}

export type AIUnit = ReturnType<typeof aiFactory>;

export function aiFactory(ai: Ai){
	return async (chat: AIChatPrompt[], systemPrompt: string) => {
		const messages = [
			{ role: "system", content: systemPrompt },
			...chat,
		];
	
		//@ts-ignore
		const response = await ai.run("@hf/thebloke/llama-2-13b-chat-awq", {
			messages
		});
	
		//@ts-ignore
		return response?.response as string ?? "AI implementation failure";
	}
}
