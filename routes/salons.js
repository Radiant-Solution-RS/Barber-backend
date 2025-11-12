const express = require('express');
const router = express.Router();
const Salon = require('../models/Salon');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Get all salons
router.get('/', async (req, res) => {
  try {
    const salons = await Salon.find();
    res.json(salons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single salon
router.get('/:id', async (req, res) => {
  try {
    const salon = await Salon.findById(req.params.id);
    if (!salon) {
      return res.status(404).json({ message: 'Salon not found' });
    }
    res.json(salon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create salon (admin only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const salon = new Salon(req.body);
    await salon.save();
    res.status(201).json(salon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update salon (admin only)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const salon = await Salon.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!salon) {
      return res.status(404).json({ message: 'Salon not found' });
    }
    res.json(salon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete salon (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const salon = await Salon.findByIdAndDelete(req.params.id);
    if (!salon) {
      return res.status(404).json({ message: 'Salon not found' });
    }
    res.json({ message: 'Salon deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
