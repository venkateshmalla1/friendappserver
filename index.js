// --- Load Environment Variables ---
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// --- Imports ---
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI, { dbName: "friendApp" })
  .then(() => {
    console.log("✅ MongoDB Connected Successfully");
    console.log("Connected DB:", mongoose.connection.name);
  })
  .catch(err => console.error("❌ MongoDB Error:", err.message));

// --- Schemas & Models ---
// People schema
const personSchema = new mongoose.Schema({
  names: [String],
  description: String,
  image: String,
  quote: String,
  relation: String,
  music: String
});
const Person = mongoose.model("Person", personSchema, "peopleData");

// User schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["public", "admin"], default: "public" }
});

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

const User = mongoose.model("User", userSchema, "userData");

// --- Auth Middleware ---
function authMiddleware(req, res, next) {
  const token = req.cookies.token || req.headers["authorization"];
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}

function roleMiddleware(requiredRole) {
  return (req, res, next) => {
    if (req.user.role !== requiredRole) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}

// --- Auth Routes ---
app.post("/api/signup", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const user = new User({ username, password, role });
    await user.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: "JWT_SECRET not configured" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("token", token, { httpOnly: true });
    res.json({ message: "Login successful", role: user.role, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Routes ---
// Status check
app.get("/api/status", (req, res) => {
  res.json({
    message: "Server is alive!",
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    dbName: mongoose.connection.name
  });
});

// Raw test route
app.get("/api/testdb", async (req, res) => {
  try {
    const people = await mongoose.connection.db.collection("peopleData").find().toArray();
    res.json(people);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public route: get person by name
app.get("/api/people/name/:name", async (req, res) => {
  try {
    const person = await Person.findOne({
      names: { $regex: new RegExp(`^${req.params.name}$`, "i") }
    });
    if (!person) return res.status(404).json({ error: "Person not found" });
    res.json(person);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin-only routes
app.get("/api/people", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const people = await Person.find();
    res.json(people);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/people", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const newPerson = new Person(req.body);
    await newPerson.save();
    res.status(201).json(newPerson);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/people/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const updatedPerson = await Person.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedPerson) return res.status(404).json({ error: "Person not found" });
    res.json(updatedPerson);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/people/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const deletedPerson = await Person.findByIdAndDelete(req.params.id);
    if (!deletedPerson) return res.status(404).json({ error: "Person not found" });
    res.json({ message: "Person deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Start Server ---
const PORT = parseInt(process.env.PORT, 10) || 5000;
console.log("PORT raw value:", process.env.PORT, "Parsed:", PORT);

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server active at http://localhost:${PORT}`);
});

server.on("error", err => {
  console.error("❌ Listen error:", err);
});
