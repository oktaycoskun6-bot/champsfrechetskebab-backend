const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Créer le dossier data s'il n'existe pas
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Base de données SQLite
const dbPath = path.join(dataDir, 'champsfrechets.db');
console.log('📁 Chemin base de données:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erreur ouverture DB:', err);
  } else {
    console.log('✅ Base de données SQLite connectée');
  }
});

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
  )`, (err) => {
    if (err) console.error('❌ Erreur table users:', err);
    else console.log('✅ Table users créée');
  });

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    items TEXT NOT NULL,
    total REAL NOT NULL,
    pickupDate TEXT NOT NULL,
    pickupTime TEXT NOT NULL,
    status TEXT DEFAULT 'received',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('❌ Erreur table orders:', err);
    else console.log('✅ Table orders créée');
  });
});

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Champs Frechet Kebab API', database: 'SQLite' });
});

// Route d'enregistrement
app.post('/api/register', (req, res) => {
  const { nom, prenom, email, telephone, adresse, npa, ville, pays, dateNaissance, password } = req.body;
  
  console.log('📝 Tentative enregistrement:', email);
  
  db.run(
    `INSERT INTO users (nom, prenom, email, telephone, adresse, npa, ville, pays, dateNaissance, password) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [nom, prenom, email, telephone, adresse, npa, ville, pays, dateNaissance, password],
    function(err) {
      if (err) {
        console.error('❌ Erreur register:', err.message);
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }
        return res.status(500).json({ error: err.message });
      }
      console.log('✅ Utilisateur créé, ID:', this.lastID);
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
        console.error('❌ Erreur login:', err);
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
        adresse: user.adresse,
        npa: user.npa,
        ville: user.ville,
        pays: user.pays
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

// Route pour récupérer toutes les commandes
app.get('/api/orders', (req, res) => {
  db.all('SELECT * FROM orders ORDER BY createdAt DESC', (err, orders) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(orders);
  });
});

// Route pour créer une commande
app.post('/api/orders', (req, res) => {
  const { userId, items, total, pickupDate, pickupTime } = req.body;
  
  db.run(
    `INSERT INTO orders (userId, items, total, pickupDate, pickupTime) 
     VALUES (?, ?, ?, ?, ?)`,
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
  console.log(`📊 Base de données: SQLite`);
});


// ========================================
// ROUTES ADMIN
// ========================================

// Créer les tables pour les produits et catégories
db.run(`CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  displayOrder INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
  if (err) console.error('❌ Erreur table categories:', err);
  else console.log('✅ Table categories créée');
});

db.run(`CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  image TEXT,
  available BOOLEAN DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
  if (err) console.error('❌ Erreur table products:', err);
  else console.log('✅ Table products créée');
});

// Middleware pour vérifier si l'utilisateur est admin
const isAdmin = (req, res, next) => {
  const adminEmail = req.headers['admin-email'];
  const adminPassword = req.headers['admin-password'];
  
  // Email admin par défaut (à changer en production)
  if (adminEmail === 'admin@champsfrechets.com' && adminPassword === 'Admin123!') {
    next();
  } else {
    res.status(403).json({ error: 'Accès refusé - Admin uniquement' });
  }
};

// ========================================
// GESTION DES CATÉGORIES
// ========================================

// Récupérer toutes les catégories
app.get('/api/admin/categories', isAdmin, (req, res) => {
  db.all('SELECT * FROM categories ORDER BY displayOrder', (err, categories) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(categories);
  });
});

// Ajouter une catégorie
app.post('/api/admin/categories', isAdmin, (req, res) => {
  const { name, displayOrder } = req.body;
  
  db.run(
    'INSERT INTO categories (name, displayOrder) VALUES (?, ?)',
    [name, displayOrder || 0],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID, name, displayOrder });
    }
  );
});

// Modifier une catégorie
app.put('/api/admin/categories/:id', isAdmin, (req, res) => {
  const { name, displayOrder } = req.body;
  
  db.run(
    'UPDATE categories SET name = ?, displayOrder = ? WHERE id = ?',
    [name, displayOrder, req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Catégorie mise à jour' });
    }
  );
});

// Supprimer une catégorie
app.delete('/api/admin/categories/:id', isAdmin, (req, res) => {
  db.run('DELETE FROM categories WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Catégorie supprimée' });
  });
});

// ========================================
// GESTION DES PRODUITS
// ========================================

// Récupérer tous les produits
app.get('/api/admin/products', isAdmin, (req, res) => {
  db.all('SELECT * FROM products ORDER BY category, name', (err, products) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(products);
  });
});

// Ajouter un produit
app.post('/api/admin/products', isAdmin, (req, res) => {
  const { name, price, category, description, image, available } = req.body;
  
  db.run(
    `INSERT INTO products (name, price, category, description, image, available) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, price, category, description, image, available !== false ? 1 : 0],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ 
        id: this.lastID, 
        name, 
        price, 
        category, 
        description, 
        image, 
        available 
      });
    }
  );
});

// Modifier un produit
app.put('/api/admin/products/:id', isAdmin, (req, res) => {
  const { name, price, category, description, image, available } = req.body;
  
  db.run(
    `UPDATE products 
     SET name = ?, price = ?, category = ?, description = ?, image = ?, available = ?, updatedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [name, price, category, description, image, available ? 1 : 0, req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Produit mis à jour' });
    }
  );
});

// Supprimer un produit
app.delete('/api/admin/products/:id', isAdmin, (req, res) => {
  db.run('DELETE FROM products WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Produit supprimé' });
  });
});

// ========================================
// RAPPORTS ET STATISTIQUES
// ========================================

// Rapport des commandes par période
app.get('/api/admin/reports/orders', isAdmin, (req, res) => {
  const { startDate, endDate, period } = req.query;
  
  let query = `
    SELECT 
      DATE(createdAt) as date,
      COUNT(*) as totalOrders,
      SUM(total) as totalRevenue,
      AVG(total) as averageOrder
    FROM orders
  `;
  
  const params = [];
  
  if (startDate && endDate) {
    query += ' WHERE DATE(createdAt) BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }
  
  if (period === 'month') {
    query += ' GROUP BY strftime("%Y-%m", createdAt)';
  } else if (period === 'year') {
    query += ' GROUP BY strftime("%Y", createdAt)';
  } else {
    query += ' GROUP BY DATE(createdAt)';
  }
  
  query += ' ORDER BY date DESC';
  
  db.all(query, params, (err, reports) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(reports);
  });
});

// Statistiques globales
app.get('/api/admin/stats', isAdmin, (req, res) => {
  const stats = {};
  
  // Total commandes
  db.get('SELECT COUNT(*) as total, SUM(total) as revenue FROM orders', (err, orderStats) => {
    if (err) return res.status(500).json({ error: err.message });
    stats.orders = orderStats;
    
    // Total utilisateurs
    db.get('SELECT COUNT(*) as total FROM users', (err, userStats) => {
      if (err) return res.status(500).json({ error: err.message });
      stats.users = userStats;
      
      // Total produits
      db.get('SELECT COUNT(*) as total FROM products', (err, productStats) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.products = productStats;
        
        // Commandes du mois
        db.get(
          `SELECT COUNT(*) as total, SUM(total) as revenue 
           FROM orders 
           WHERE strftime('%Y-%m', createdAt) = strftime('%Y-%m', 'now')`,
          (err, monthStats) => {
            if (err) return res.status(500).json({ error: err.message });
            stats.thisMonth = monthStats;
            
            res.json(stats);
          }
        );
      });
    });
  });
});

// Produits les plus vendus
app.get('/api/admin/reports/top-products', isAdmin, (req, res) => {
  const { limit } = req.query;
  
  db.all(
    `SELECT 
      items,
      COUNT(*) as orderCount
     FROM orders
     GROUP BY items
     ORDER BY orderCount DESC
     LIMIT ?`,
    [limit || 10],
    (err, topProducts) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(topProducts);
    }
  );
});

console.log('✅ Routes admin configurées');
