const express = require('express');
const router = express.Router();
const Barber = require('../models/Barber');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const barbers = await Barber.find({ isActive: true });
    res.json(barbers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const barbers = await Barber.find();
    res.json(barbers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


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


router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, email, phone, specialties, isActive, schedule, services } = req.body;
    
    const updateData = { name, email, phone, specialties, isActive };
    if (schedule) {
      updateData.schedule = schedule;
    }
    if (services !== undefined) {
      updateData.services = services;
    }
    
    const barber = await Barber.findByIdAndUpdate(
      req.params.id,
      updateData,
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

router.put('/:id/schedule', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const schedule = req.body;
    
    const barber = await Barber.findByIdAndUpdate(
      req.params.id,
      { schedule },
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


router.put('/:id/weekly-schedule', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { weekSchedule } = req.body; 
    
    const barber = await Barber.findById(req.params.id);
    if (!barber) {
      return res.status(404).json({ message: 'Barber not found' });
    }

    if (!barber.scheduleOverrides) {
      barber.scheduleOverrides = [];
    }

    weekSchedule.forEach(daySchedule => {
      const existingIndex = barber.scheduleOverrides.findIndex(
        override => override.date === daySchedule.date
      );

      if (existingIndex >= 0) {
        barber.scheduleOverrides[existingIndex] = daySchedule;
      } else {
        barber.scheduleOverrides.push(daySchedule);
      }
    });

    await barber.save();
    res.json(barber);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

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
