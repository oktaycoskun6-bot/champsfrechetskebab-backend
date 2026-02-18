const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Configuration PostgreSQL depuis les variables d'environnement Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Initialiser les tables
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(255) NOT NULL,
        prenom VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        telephone VARCHAR(50) NOT NULL,
        adresse TEXT NOT NULL,
        npa VARCHAR(10) NOT NULL,
        ville VARCHAR(255) NOT NULL,
        pays VARCHAR(100) NOT NULL,
        dateNaissance VARCHAR(50) NOT NULL,
        password VARCHAR(255) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        userId INTEGER NOT NULL,
        items TEXT NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        pickupDate VARCHAR(50) NOT NULL,
        pickupTime VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'received',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Tables PostgreSQL créées avec succès');
  } catch (error) {
    console.error('❌ Erreur création tables:', error);
  }
}

initDatabase();

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Champs Frechet Kebab API' });
});

// Route d'enregistrement
app.post('/api/register', async (req, res) => {
  const { nom, prenom, email, telephone, adresse, npa, ville, pays, dateNaissance, password } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO users (nom, prenom, email, telephone, adresse, npa, ville, pays, dateNaissance, password) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [nom, prenom, email, telephone, adresse, npa, ville, pays, dateNaissance, password]
    );
    
    res.status(201).json({ 
      id: result.rows[0].id,
      message: 'Compte créé avec succès'
    });
  } catch (error) {
    if (error.code === '23505') { // Code PostgreSQL pour violation de contrainte UNIQUE
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }
    console.error('Erreur register:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route de connexion
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND password = $2',
      [email, password]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    const user = result.rows[0];
    res.json({ 
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      telephone: user.telephone,
      adresse: user.adresse,
      npa: user.npa,
      ville: user.ville,
      pays: user.pays
    });
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour récupérer un utilisateur
app.get('/api/users/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erreur get user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour récupérer toutes les commandes
app.get('/api/orders', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders ORDER BY createdAt DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur get orders:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour créer une commande
app.post('/api/orders', async (req, res) => {
  const { userId, items, total, pickupDate, pickupTime } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO orders (userId, items, total, pickupDate, pickupTime) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [userId, JSON.stringify(items), total, pickupDate, pickupTime]
    );
    
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    console.error('Erreur create order:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
  console.log(`📊 Base de données: PostgreSQL`);
});
