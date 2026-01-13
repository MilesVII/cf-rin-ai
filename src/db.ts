import { Generated, Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

type Database = {
	reminders: {
		id: Generated<number>,
		chat: string,
		at: string,
		message: string
	}
}

export function createConnector(db: D1Database) {
	return () => connectDB(db);
}
export function connectDB(db: D1Database) {
	return new Kysely<Database>({ dialect: new D1Dialect({ database: db }) });
}

export type KyselyDB = Kysely<Database>;
