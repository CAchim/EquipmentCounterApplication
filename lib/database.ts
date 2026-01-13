import mysql from 'serverless-mysql';

const dbConn = mysql({
  config: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
});

console.log("The db file was executed");

// Generic query function
export default async function queryDatabase<T = any>(sqlCommand: string, values: any[] = []): Promise<T[]> {
  try {
    const results = await dbConn.query<T[]>({ sql: sqlCommand, values, timeout: 10000 });
    await dbConn.end();
    return results;
  } catch (error) {
    console.error("Database error:", error);
    await dbConn.end();
    throw error;
  }
}
