

type AppealedCommand = {
	triggers: string[],
	command: string,
	protected?: boolean,
	description?: string,
	responses?: string[]
}

type AutoResponse = {
	triggers: string[],
	responses: string[],
}

type POTDGame = {
	loaders: string[][],
	members: string[][]
}

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
		wats: string[],
		ahs: string[],
		blush: {
			chance: number,
			says: string[]
		},
		masters: string[],
		me: string,
		potd: POTDGame,
		protectedCommandFailResponse: string[]
	},
	state: {
		drafted: boolean
	}
}

export type Storage = {
	get: <T extends keyof StorageSchema>(key: T) => Promise<StorageSchema[T]>,
	set: <T extends keyof StorageSchema>(key: T, value: StorageSchema[T]) => Promise<void>
};