import dotenv from "dotenv";
dotenv.config();
import { DataSource } from "typeorm";
import { SqlDatabase } from "langchain/sql_db";


async function createMSSQLDataSource() {
  // Create TypeORM DataSource configuration for MSSQL
  const dataSource = new DataSource({
    type: "mssql",
    host: process.env.SQL_SERVER,
    port: parseInt(process.env.SQL_PORT || 1433),
    username: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DATABASE,
    options: {
      encrypt: true,
      trustServerCertificate: true
    },
    extra: {
      options: {
        encrypt: true,
        trustServerCertificate: true
      }
    },
    synchronize: false, // Important: disable schema synchronization
    logging: false // Disable logging for cleaner output
  });

  // Initialize the connection
  await dataSource.initialize();
  return dataSource;
}

async function getMSSQLDatabase() {
  const dataSource = await createMSSQLDataSource();
  
  // Create LangChain SqlDatabase instance
  return await SqlDatabase.fromDataSourceParams({
    appDataSource: dataSource,
    // includesTables: [], // Leave empty to include all tables
    // // Or specify tables to include:
    includesTables: ['Artist', 'Album', 'Employee', 'Customer', 'Invoice'],
    // ignoreTables: [] // Tables to exclude
  });
}

// Usage example:
async function main() {
  const db = await getMSSQLDatabase();
  
  // Get table info to verify connection
  const tableInfo = await db.getTableInfo();
  console.log("Connected to database. Tables:", Object.keys(tableInfo));
  
  // Remember to close the connection when done
  await db.appDataSource.destroy();
}

main().catch(console.error);