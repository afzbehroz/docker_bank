import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs"; // Import bcryptjs for hashing passwords
import dotenv from "dotenv";

dotenv.config(); // Load environment variables from .env

// Log to confirm environment variables are loaded correctly
console.log("Database Config:", {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
});

const app = express();

const pool = mysql.createPool({
    host: process.env.DB_HOST || "mysql", // Default to 'mysql' for Docker containers
    user: process.env.DB_USER || "root", // Default to 'root'
    password: process.env.DB_PASSWORD || "root", // Default to 'root'
    database: process.env.DB_NAME || "Bank3", // Default to 'Bank3'
    port: process.env.DB_PORT || 3306, // Default to 3306
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Helper function to generate a one-time password (OTP)
function generateOTP() {
    const otp = Math.floor(100000 + Math.random() * 900000);
    return otp.toString();
}

// Routes

// POST: new user and account
app.post("/users", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send("Username and password are required");
    }

    try {
        // Hash the password before saving it
        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            [username, hashedPassword]
        );

        const userId = result.insertId;

        await pool.query(
            "INSERT INTO accounts (userId, amount) VALUES (?, ?)",
            [userId, 0]
        );

        res.status(201).send({
            message: "User and account created successfully",
            userId,
        });
    } catch (error) {
        // Log the error to the console for debugging
        console.error("Error in /users route:", error.message, error.stack);
        res.status(500).send("Database error");
    }
});

// POST: Log in a user and generate a one-time password (OTP)
app.post("/sessions", async (req, res) => {
    const { username, password } = req.body;

    try {
        const [rows] = await pool.query(
            "SELECT * FROM users WHERE username = ?",
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).send("Invalid username or password");
        }

        const user = rows[0];

        // Check the password using bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).send("Invalid username or password");
        }

        const token = generateOTP();

        await pool.query("INSERT INTO sessions (userId, token) VALUES (?, ?)", [
            user.id,
            token,
        ]);

        res.status(200).send({ message: "Login successful", token });
    } catch (error) {
        console.error("Error in /sessions route:", error.message, error.stack);
        res.status(500).send("Database error");
    }
});

// GET: Fetch account details
app.get("/account", async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).send("Token is required");
    }

    try {
        const [sessions] = await pool.query(
            "SELECT * FROM sessions WHERE token = ?",
            [token]
        );

        if (sessions.length === 0) {
            return res.status(401).send("Invalid or expired token");
        }

        const session = sessions[0];
        const [accounts] = await pool.query(
            "SELECT * FROM accounts WHERE userId = ?",
            [session.userId]
        );

        if (accounts.length === 0) {
            return res.status(404).send("Account not found");
        }

        res.status(200).send({ account: accounts[0] });
    } catch (error) {
        console.error("Error in /account route:", error.message, error.stack);
        res.status(500).send("Database error");
    }
});

// POST: Fetch account balance
app.post("/me/accounts", async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).send("Token is required");
    }

    try {
        const [sessions] = await pool.query(
            "SELECT * FROM sessions WHERE token = ?",
            [token]
        );

        if (sessions.length === 0) {
            return res.status(401).send("Invalid or expired token");
        }

        const session = sessions[0];
        const [accounts] = await pool.query(
            "SELECT * FROM accounts WHERE userId = ?",
            [session.userId]
        );

        if (accounts.length === 0) {
            return res.status(404).send("Account not found");
        }

        res.status(200).send({ balance: accounts[0].amount });
    } catch (error) {
        console.error(
            "Error in /me/accounts route:",
            error.message,
            error.stack
        );
        res.status(500).send("Database error");
    }
});

// POST: Deposit money into the account
app.post("/me/accounts/transactions", async (req, res) => {
    const { token, amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).send("Invalid amount");
    }

    try {
        const [sessions] = await pool.query(
            "SELECT * FROM sessions WHERE token = ?",
            [token]
        );

        if (sessions.length === 0) {
            return res.status(401).send("Invalid or expired token");
        }

        const session = sessions[0];
        const [accounts] = await pool.query(
            "SELECT * FROM accounts WHERE userId = ?",
            [session.userId]
        );

        if (accounts.length === 0) {
            return res.status(404).send("Account not found");
        }

        const account = accounts[0];
        const newBalance = account.amount + amount;

        await pool.query("UPDATE accounts SET amount = ? WHERE userId = ?", [
            newBalance,
            session.userId,
        ]);

        res.status(200).send({
            message: "Deposit successful",
            balance: newBalance,
        });
    } catch (error) {
        console.error(
            "Error in /me/accounts/transactions route:",
            error.message,
            error.stack
        );
        res.status(500).send("Database error");
    }
});

// Start the server
const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log(`Bank backend is running at http://localhost:${port}`);
});
