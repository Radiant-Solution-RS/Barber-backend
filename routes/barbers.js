const express = require('express');
const router = express.Router();
const Barber = require('../models/Barber');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Get all barbers (public)
router.get('/', async (req, res) => {
  try {
    const barbers = await Barber.find({ isActive: true });
    res.json(barbers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all barbers including inactive (admin only)
router.get('/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const barbers = await Barber.find();
    res.json(barbers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create barber (admin only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, email, phone, specialties } = req.body;

    const existingBarber = await Barber.findOne({ email });
    if (existingBarber) {
      return res.status(400).json({ message: 'Barber with this email already exists' });
    }

    const barber = new Barber({
      name,
      email,
      phone,
      specialties,
    });

    await barber.save();
    res.status(201).json(barber);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update barber (admin only)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, email, phone, specialties, isActive } = req.body;
    
    const barber = await Barber.findByIdAndUpdate(
      req.params.id,
      { name, email, phone, specialties, isActive },
      { new: true }
    );

    if (!barber) {
      return res.status(404).json({ message: 'Barber not found' });
    }

    res.json(barber);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete barber (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const barber = await Barber.findByIdAndDelete(req.params.id);
    
    if (!barber) {
      return res.status(404).json({ message: 'Barber not found' });
    }

    res.json({ message: 'Barber deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
