import {
	Injectable,
	Logger,
	OnApplicationShutdown,
	OnModuleInit,
	ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import oracledb from 'oracledb';

const ORACLE_IDENTIFIER_PATTERN = /^[A-Z][A-Z0-9_$#]*$/i;
const CURSOR_FETCH_SIZE = 1_000;

export type OracleProcedureResult = Omit<
	oracledb.Result<unknown>,
	'outBinds'
> & {
	outBinds?: Record<string, unknown>;
};

export interface OracleHealth {
	status: 'connected';
	databaseTime: string;
}

interface DatabaseTimeRow {
	DATABASE_TIME: Date;
}

@Injectable()
export class OracleService implements OnModuleInit, OnApplicationShutdown {
	private readonly logger = new Logger(OracleService.name);
	private pool?: oracledb.Pool;

	constructor(private readonly configService: ConfigService) {}

	async onModuleInit(): Promise<void> {
		if (!this.configService.get<boolean>('oracle.enabled', false)) {
			this.logger.warn('Oracle connection pool is disabled');
			return;
		}

		this.pool = await oracledb.createPool({
			user: this.configService.getOrThrow<string>('oracle.user'),
			password: this.configService.getOrThrow<string>('oracle.password'),
			connectString: this.configService.getOrThrow<string>(
				'oracle.connectString',
			),
			poolMin: this.configService.get<number>('oracle.poolMin', 2),
			poolMax: this.configService.get<number>('oracle.poolMax', 10),
			poolTimeout: this.configService.get<number>('oracle.poolTimeout', 60),
		});

		this.logger.log('Oracle connection pool initialized');
	}

	async executeProcedure(
		packageName: string,
		procedureName: string,
		binds: oracledb.BindParameters,
	): Promise<OracleProcedureResult> {
		if (!this.pool) {
			throw new ServiceUnavailableException('Database is not available');
		}

		this.assertIdentifier(packageName);
		this.assertIdentifier(procedureName);

		const parameterNames = Object.keys(binds);
		for (const parameterName of parameterNames) {
			this.assertIdentifier(parameterName);
		}

		const assignments = parameterNames
			.map((parameterName) => `${parameterName} => :${parameterName}`)
			.join(', ');
		const statement = `BEGIN ${packageName}.${procedureName}(${assignments}); END;`;
		const connection = await this.pool.getConnection();

		try {
			const result = await connection.execute(statement, binds, {
				outFormat: oracledb.OUT_FORMAT_OBJECT,
			});
			const outBinds = await this.materializeOutBinds(result.outBinds);

			return { ...result, outBinds };
		} finally {
			await connection.close();
		}
	}

	async executeQuery<T>(
		statement: string,
		binds: oracledb.BindParameters = {},
		options: oracledb.ExecuteOptions = {},
	): Promise<T[]> {
		if (!this.pool) {
			throw new ServiceUnavailableException('Database is not available');
		}

		const connection = await this.pool.getConnection();
		try {
			const result = await connection.execute<T>(statement, binds, {
				...options,
				outFormat: oracledb.OUT_FORMAT_OBJECT,
			});
			return result.rows ?? [];
		} finally {
			await connection.close();
		}
	}

	async executeMutation(
		statement: string,
		binds: oracledb.BindParameters = {},
	): Promise<number> {
		return this.withTransaction(async (connection) => {
			const result = await connection.execute(statement, binds);
			return result.rowsAffected ?? 0;
		});
	}

	async withTransaction<T>(
		work: (connection: oracledb.Connection) => Promise<T>,
	): Promise<T> {
		if (!this.pool) {
			throw new ServiceUnavailableException('Database is not available');
		}

		const connection = await this.pool.getConnection();
		try {
			const result = await work(connection);
			await connection.commit();
			return result;
		} catch (error) {
			await connection.rollback();
			throw error;
		} finally {
			await connection.close();
		}
	}

	async checkConnection(): Promise<OracleHealth> {
		if (!this.pool) {
			throw new ServiceUnavailableException('Database is not available');
		}

		let connection: oracledb.Connection | undefined;
		try {
			connection = await this.pool.getConnection();
			const result = await connection.execute<DatabaseTimeRow>(
				'SELECT SYSDATE AS DATABASE_TIME FROM DUAL',
				{},
				{ outFormat: oracledb.OUT_FORMAT_OBJECT },
			);
			const databaseTime = result.rows?.[0]?.DATABASE_TIME;

			if (!databaseTime) {
				throw new Error('Oracle health check returned no data');
			}

			return {
				status: 'connected',
				databaseTime: databaseTime.toISOString(),
			};
		} catch (error) {
			const stack = error instanceof Error ? error.stack : undefined;
			this.logger.error('Oracle health check failed', stack);
			throw new ServiceUnavailableException('Database is not available');
		} finally {
			await connection?.close();
		}
	}

	async onApplicationShutdown(): Promise<void> {
		if (!this.pool) {
			return;
		}

		await this.pool.close(10);
		this.pool = undefined;
		this.logger.log('Oracle connection pool closed');
	}

	private assertIdentifier(identifier: string): void {
		if (!ORACLE_IDENTIFIER_PATTERN.test(identifier)) {
			throw new TypeError(`Invalid Oracle identifier: ${identifier}`);
		}
	}

	private async materializeOutBinds(
		outBinds: unknown,
	): Promise<Record<string, unknown> | undefined> {
		if (!outBinds || typeof outBinds !== 'object' || Array.isArray(outBinds)) {
			return undefined;
		}

		const materializedEntries = await Promise.all(
			Object.entries(outBinds).map(async ([name, value]) => [
				name,
				this.isResultSet(value) ? await this.readResultSet(value) : value,
			]),
		);

		return Object.fromEntries(materializedEntries);
	}

	private isResultSet(value: unknown): value is oracledb.ResultSet<unknown> {
		if (!value || typeof value !== 'object') {
			return false;
		}

		const candidate = value as Partial<oracledb.ResultSet<unknown>>;
		return (
			typeof candidate.getRows === 'function' &&
			typeof candidate.close === 'function'
		);
	}

	private async readResultSet(
		resultSet: oracledb.ResultSet<unknown>,
	): Promise<unknown[]> {
		const rows: unknown[] = [];

		try {
			let batch: unknown[];
			do {
				batch = await resultSet.getRows(CURSOR_FETCH_SIZE);
				rows.push(...batch);
			} while (batch.length === CURSOR_FETCH_SIZE);

			return rows;
		} finally {
			await resultSet.close();
		}
	}
}
