const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Supprimer l'ancienne base de données si RESET_DB est défini
if (process.env.RESET_DB === 'true' && fs.existsSync('./champsfrechets.db')) {
  console.log('🗑️  Suppression de l\'ancienne base de données...');
  fs.unlinkSync('./champsfrechets.db');
  console.log('✅ Base de données supprimée');
}

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
    npa TEXT NOT NULL,
    ville TEXT NOT NULL,
    pays TEXT NOT NULL,
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
  
  console.log('✅ Tables créées avec succès');
});

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Champs Frechet Kebab API' });
});

// Route d'enregistrement
app.post('/api/register', (req, res) => {
  const { nom, prenom, email, telephone, adresse, npa, ville, pays, dateNaissance, password } = req.body;
  
  db.run(
    `INSERT INTO users (nom, prenom, email, telephone, adresse, npa, ville, pays, dateNaissance, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [nom, prenom, email, telephone, adresse, npa, ville, pays, dateNaissance, password],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ 
        id: this.lastID,
        message: 'Compte créé avec succès'
      });
    }
  );
});

// Route de connexion
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  db.get(
    'SELECT * FROM users WHERE email = ? AND password = ?',
    [email, password],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!user) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }
      res.json({ 
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        telephone: user.telephone,
        adresse: user.adresse
      });
    }
  );
});

// Route pour récupérer un utilisateur
app.get('/api/users/:id', (req, res) => {
  db.get('SELECT * FROM users WHERE id = ?', [req.params.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    res.json(user);
  });
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
