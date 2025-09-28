// Database types for D1 tables

export interface Client {
	id: number;
	name: string;
	email: string;
	created_at: string;
	updated_at: string;
}

export interface User {
	id: number;
	username: string;
	email: string;
	created_at: string;
	updated_at: string;
}

// Query result types
export interface QueryResult<T> {
	success: boolean;
	results: T[];
	meta: {
		duration: number;
		rows_read: number;
		rows_written: number;
	};
}

// Database connection interface
export interface DatabaseConnection {
	clients: {
		getAll(): Promise<Client[]>;
		getById(id: number): Promise<Client | null>;
		create(data: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<Client>;
		update(
			id: number,
			data: Partial<Omit<Client, 'id' | 'created_at' | 'updated_at'>>
		): Promise<Client | null>;
		delete(id: number): Promise<boolean>;
	};
	users: {
		getAll(): Promise<User[]>;
		getById(id: number): Promise<User | null>;
		create(data: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User>;
		update(
			id: number,
			data: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
		): Promise<User | null>;
		delete(id: number): Promise<boolean>;
	};
}
