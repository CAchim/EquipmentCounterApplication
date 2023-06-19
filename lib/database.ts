import mysql from 'serverless-mysql'

const con = mysql({
  config: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
})
console.log("The db file was executed")

export default async function queryDatabase(sqlCommand: string) {
  try {
    const results = await con.query({ sql: sqlCommand, timeout: 10000 })
    await con.end()
    return new Promise((resolve, reject) => {
      resolve(results)
    })
  } catch (error) {
    throw error
  }
}
