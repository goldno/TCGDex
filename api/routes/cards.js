const express = require('express');
const router = express.Router();
const db = require('../../src/db');

// GET /cards?search=charizard
router.get('/', async (req, res) => {
  const { search } = req.query;
  try {
    let query, params;
    if (search) {
      query = `SELECT * FROM tracked_cards WHERE name ILIKE $1 ORDER BY set_name, collector_number LIMIT 50`;
      params = [`%${search}%`];
    } else {
      query = `SELECT * FROM tracked_cards ORDER BY set_name, collector_number`;
      params = [];
    }
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /cards/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM tracked_cards WHERE product_id = $1',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Card not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
