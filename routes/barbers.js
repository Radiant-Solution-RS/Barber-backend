const express = require('express');
const router = express.Router();
const Barber = require('../models/Barber');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { uploadBarberImage } = require('../config/cloudinary');

router.get('/', async (req, res) => {
  try {
    const barbers = await Barber.find({ isActive: true });
    res.json(barbers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Upload barber/team member image to Cloudinary (admin only)
router.post('/upload-image', authMiddleware, adminMiddleware, uploadBarberImage.single('image'), async (req, res) => {
  try {
    console.log('Barber image upload request received');
    console.log('File:', req.file);
    
    if (!req.file) {
      console.error('No file in request');
      return res.status(400).json({ message: 'No image file provided' });
    }

    console.log('Barber image uploaded successfully to:', req.file.path);
    
    // Cloudinary automatically uploads and returns the URL
    res.json({
      message: 'Image uploaded successfully',
      imageUrl: req.file.path, // Cloudinary URL
      publicId: req.file.filename, // Cloudinary public ID
    });
  } catch (error) {
    console.error('Error uploading barber image:', error);
    res.status(500).json({ 
      message: 'Error uploading image', 
      error: error.message,
      stack: error.stack 
    });
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
    const { name, email, phone, specialties, profileImage } = req.body;

    const existingBarber = await Barber.findOne({ email });
    if (existingBarber) {
      return res.status(400).json({ message: 'Barber with this email already exists' });
    }

    const barber = new Barber({
      name,
      email,
      phone,
      specialties,
      profileImage,
    });

    await barber.save();
    res.status(201).json(barber);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, email, phone, specialties, isActive, schedule, services, profileImage } = req.body;
    
    const updateData = { name, email, phone, specialties, isActive };
    if (schedule) {
      updateData.schedule = schedule;
    }
    if (services !== undefined) {
      updateData.services = services;
    }
    if (profileImage !== undefined) {
      updateData.profileImage = profileImage;
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
