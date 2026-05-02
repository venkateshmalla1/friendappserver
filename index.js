// --- Load Environment Variables ---
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// --- Imports ---
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI, { dbName: "friendApp" })
  .then(() => {
    console.log("✅ MongoDB Connected Successfully");
    console.log("Connected DB:", mongoose.connection.name);
  })
  .catch(err => console.error("❌ MongoDB Error:", err.message));

// --- Schema & Model ---
const personSchema = new mongoose.Schema({
  names: [String],
  description: String,
  image: String,
  quote: String,
  relation: String,
  music: String
});

// Explicitly bind to "peopleData" collection
const Person = mongoose.model('Person', personSchema, 'peopleData');

// --- Routes ---

// Status check
app.get('/api/status', (req, res) => {
  res.json({
    message: "Server is alive!",
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    dbName: mongoose.connection.name
  });
});

// Raw test route (direct collection query)
app.get('/api/testdb', async (req, res) => {
  try {
    const people = await mongoose.connection.db.collection('peopleData').find().toArray();
    res.json(people);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CRUD routes
app.get('/api/people', async (req, res) => {
  try {
    const people = await Person.find();
    res.json(people);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/people/:id', async (req, res) => {
  try {
    const person = await Person.findById(req.params.id);
    if (!person) return res.status(404).json({ error: "Person not found" });
    res.json(person);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/people', async (req, res) => {
  try {
    const newPerson = new Person(req.body);
    await newPerson.save();
    res.status(201).json(newPerson);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/people/:id', async (req, res) => {
  try {
    const updatedPerson = await Person.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedPerson) return res.status(404).json({ error: "Person not found" });
    res.json(updatedPerson);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET person by name (case-insensitive)
app.get('/api/people/name/:name', async (req, res) => {
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


app.delete('/api/people/:id', async (req, res) => {
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
