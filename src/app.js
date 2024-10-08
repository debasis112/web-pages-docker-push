// Declaration
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const app = express();
const port = process.env.PORT || 3000;
require('dotenv').config();

// SQL server configuration (using environment variables for security)
const config = {
    user: process.env.SQL_USER_ID,
    password: process.env.SQL_DB_PASS,
    server: process.env.SQL_DB_HOST, // server name
    database: process.env.SQL_DB_NAME,
    options: {
      encrypt: process.env.SQL_DB_ENCRYPT === 'true', // Convert string to boolean
    },
};

// Acknoknowledge of connection to SQL Server
sql.connect(config).then(pool => {
    console.log('Connected to Azure SQL Database');
    return pool;
  }).catch(err => {
    console.log('Database connection failed:', err);
  });

// Function to check if a table exists
async function tableExists(tableName) {
  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .query(`SELECT * 
              FROM INFORMATION_SCHEMA.TABLES 
              WHERE TABLE_NAME = '${tableName}'`);
    
    return result.recordset.length > 0; // True if table exists, false otherwise
  } catch (error) {
    console.error('Error checking table existence:', error);
    throw error;
  }
}

// Function to create a table
async function createTable(tableName, createQuery) {
  try {
    const pool = await sql.connect(config);
    await pool.request().query(createQuery);
    console.log(`Table '${tableName}' has been created successfully.`);
  } catch (error) {
    console.error(`Error creating table '${tableName}':`, error);
    throw error;
  }
}

// Main function to check and create tables if not exists
async function checkAndCreateTables() {
  const tables = [
    {
      name: 'Appointments',
      createQuery: `
        CREATE TABLE Appointments (
          id INT PRIMARY KEY IDENTITY(1,1),
          name NVARCHAR(100),
          email NVARCHAR(100),
          Purpose NVARCHAR(100),
          number1 NVARCHAR(15),
          number2 NVARCHAR(15),
          Department NVARCHAR(100),
          date DATE,
          Time NVARCHAR(20),
          CONSTRAINT UC_Appointments UNIQUE (name, email, Purpose, number1, date)
        );
      `,
    },
    {
      name: 'Users',
      createQuery: `
        CREATE TABLE Users (
          UserID INT PRIMARY KEY IDENTITY,
          Username NVARCHAR(50),
          PasswordHash NVARCHAR(255),
          EmailAddress NVARCHAR(255) UNIQUE
        );
      `,
    },
  ];

  try {
    for (const table of tables) {
      const exists = await tableExists(table.name);
      if (!exists) {
        console.log(`Table '${table.name}' does not exist. Creating it now...`);
        await createTable(table.name, table.createQuery);
      } else {
        console.log(`Table '${table.name}' already exists.`);
      }
    }
  } catch (error) {
    console.error('Error during table check or creation:', error);
  } finally {
    sql.close();
  }
}

// Check and create tables when server starts
checkAndCreateTables();

// Set the view engine to EJS
app.set('view engine', 'ejs');

// Set up body-parser middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/index', (req, res) => {
    res.render('index');
});

app.get('/blog', (req, res) => {
    res.render('blog');
});

app.get('/about', (req, res) => {
    res.render('about');
});

app.get('/contact', (req, res) => {
    res.render('contact');
});

app.get('/doctors', (req, res) => {
    res.render('doctors');
});

app.get('/packages', (req, res) => {
    res.render('packages');
});

app.get('/gallery', (req, res) => {
    res.render('gallery');
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/registration', (req, res) => {
    res.render('registration');
});

app.get('/appointment', (req, res) => {
    res.render('appointment');
});

app.get('/terms', (req, res) => {
    res.render('terms');
});

app.get('/privacy', (req, res) => {
    res.render('privacy');
});

// Link to DB to store user registration in SQL server
app.post('/registration', async (req, res) => {
    const { userName, password, email } = req.body;
    try {
        // Connect to the database
        const pool = await sql.connect(config);
        // Check if the email already exists
        const result = await pool.request()
            .input('EmailAddress', sql.VarChar, email)
            .query('SELECT * FROM Users WHERE EmailAddress = @EmailAddress');
        if (result.recordset.length > 0) {
            // If email already exists, return an error message
            res.send('Email already registered. Please use a different email.');
        } else {
            // If email is not found, proceed with registration....
            // Hash the password before storing it
            const hashedPassword = await bcrypt.hash(password, 10);
            // Insert the new user into the database
            await sql.query`INSERT INTO Users (UserName, PasswordHash, EmailAddress)
                VALUES (${userName}, ${hashedPassword}, ${email})`;
            // Send a success response with redirection
             res.render('regSuc', {
                title: 'Registration Success',
                redirectUrl: '/login'
            });
        }
    } catch (err) {
        res.status(500).send('Error during registration: ' + err);
    }
});

// For login using credentials from DB created in registration.
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Establsihing connection to DB
        const pool = await sql.connect(config);
        // Getting details for emailId
        const result = await sql.query`SELECT * FROM users WHERE EmailAddress = ${email}`;
        // Checking for emailId is valid
        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            // Checking for password associated for the emailId
            const passwordMatch = await bcrypt.compare(password, user.PasswordHash);
            // If password matches
            if (passwordMatch) {
                res.render('loginSuc', {
                    title: 'Login Successful',
                    redirectUrl: '/appointment'
                });
            } else {
                res.send("Invalid credentials");
            }
        } else {
            res.send("Invalid Email ID");
        }
    } catch (err) {
        res.status(500).send("Error during login: " + err);
    }
});

// For appointment booking store in DB.
app.post('/appointment', async (req, res) => {
    const { name, email, Purpose, number1, number2, Department, date, Time } = req.body;
    // To check if a number is exactly 10 digits
    const phoneNumberRegex = /^\d{10}$/;
    if (!phoneNumberRegex.test(number1) || !phoneNumberRegex.test(number2)) {
        return res.status(400).send('Please enter a valid 10-digit mobile number.');
    }
    try {
      // Connect to the database
      await sql.connect(config);
      // Checking if appointment exist for the below details
      const existingAppointment = await sql.query`
            SELECT * FROM Appointments
            WHERE name = ${name}
              AND email = ${email}
              AND Purpose = ${Purpose}
              AND number1 = ${number1}
              AND date = ${date}`;
        // If Appointment exists
        if (existingAppointment.recordset.length > 0) {
            return res.status(400).send('An appointment with these details already exists for this day. Please choose a different date or details.');
        } else {

      // Insert appointment details
      await sql.query`INSERT INTO Appointments (name, email, Purpose, number1, number2, Department, date, Time)
                      VALUES (${name}, ${email}, ${Purpose}, ${number1}, ${number2}, ${Department}, ${date}, ${Time})`;
      // Fetch the latest appointment details
      const result = await sql.query`SELECT TOP 1 * FROM Appointments ORDER BY id DESC`;
  
      // Render the confirmation page with the details
      res.render('appSuc', { appointment: result.recordset[0] });}
    } catch (err) {
        res.status(500).send("Error during booking: " + err);
    }
  });

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
