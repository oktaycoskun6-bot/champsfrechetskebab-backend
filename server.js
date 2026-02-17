const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Base de données SQLite
const db = new sqlite3.Database('./champsfrechets.db');

// Initialiser les tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telephone TEXT NOT NULL,
    adresse TEXT NOT NULL,
    dateNaissance TEXT NOT NULL,
    password TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    items TEXT NOT NULL,
    total REAL NOT NULL,
    pickupDate TEXT NOT NULL,
    pickupTime TEXT NOT NULL,
    status TEXT DEFAULT 'received',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Champs Frechet Kebab API' });
});

app.get('/api/orders', (req, res) => {
  db.all('SELECT * FROM orders ORDER BY createdAt DESC', (err, orders) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(orders);
  });
});

app.post('/api/orders', (req, res) => {
  const { userId, items, total, pickupDate, pickupTime } = req.body;
  
  db.run(
    `INSERT INTO orders (userId, items, total, pickupDate, pickupTime) VALUES (?, ?, ?, ?, ?)`,
    [userId, JSON.stringify(items), total, pickupDate, pickupTime],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
        }
      res.status(201).json({ id: this.lastID });
    }
  );
});

app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
});
