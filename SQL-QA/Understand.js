// import { ChatGroq } from "@langchain/groq";
// // first i will create a model which we can connect and chat with
// const groq = new ChatGroq({
// apiKey: process.env.GROQ_API_KEY,
// model: "llama-3.3-70b-versatile", 
// temperature: 0
// });

// here we are having the ChatGroq method because we are using the langchain groq library
// how to use this groq object
// we need to create a function in js
// async function chatWithGroq(question) 
// {
//     // console.log(`\n Model: ${groq}`);
//     let response= await groq.invoke(question); ////INVOKE IS THE METHOD TO CALL THE MODEL
//     console.log(`\n response: ${response.text}`);
// }
// chatWithGroq("What is the sql?");

// next up how to connect to the mssql database
// import mssql from 'mssql';
// mssql.connect({
//     user: process.env.SQL_USER,
//     password: process.env.SQL_PASSWORD,
//     server: process.env.SQL_SERVER,
//     database: process.env.SQL_DATABASE,
//     options: {
//         encrypt: true, // Use encryption for the connection
//         trustServerCertificate: true // Trust the server certificate
//     }   
// }).then(pool => {
//     console.log('Connected to the database successfully!');
//     // Example query
//     return pool.request()
//         .query('SELECT * FROM Artist'); // Replace 'YourTableName' with your actual table name
// }).then(result => {
//     console.log('Query result:', result.recordset);
// }).catch(err => {
//     console.error('Database connection failed:', err);
// }).finally(() => {
//     mssql.close(); // Close the connection
// });

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