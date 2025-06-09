const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = 3000;

const BASE_URL = "/momo-app"

// Serve the frontend from public
app.use(BASE_URL, express.static(path.join(__dirname, 'public')));

// Connect to database
const db = new sqlite3.Database(path.join(__dirname, 'momo_transactions.db'), (err) => {
  if (err) {
    console.error('Failed to connect to db:', err.message);
  } else {
    console.log('Connected to to db');
  }
});

// API endpoint to get transactions with optional date range querying
app.get(BASE_URL + '/api/transactions', (req, res) => {
  const { from, to } = req.query;
  
  let query = 'SELECT * FROM transactions';
  const params = [];
  
  if (from || to) {
    query += ' WHERE 1=1';
    
    if (from) {
      query += ' AND date >= ?';
      params.push(new Date(from).toISOString());
    }
    
    if (to) {
      query += ' AND date <= ?';
      // Include the entire to day
      const toDate = new Date(to);
      toDate.setDate(toDate.getDate() + 1);
      params.push(toDate.toISOString());
    }
  }
  
  query += ' ORDER BY date DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Close database connection on process termination
process.on('SIGINT', () => {
  db.close(() => {
    console.log('Database connection closed.');
    process.exit(0);
  });
});
