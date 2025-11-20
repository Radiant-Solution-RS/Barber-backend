const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

// Upload image to Cloudinary (admin only)
router.post('/upload-image', authMiddleware, adminMiddleware, upload.single('image'), async (req, res) => {
  try {
    console.log('Upload request received');
    console.log('File:', req.file);
    
    if (!req.file) {
      console.error('No file in request');
      return res.status(400).json({ message: 'No image file provided' });
    }

    console.log('Image uploaded successfully to:', req.file.path);
    
    // Cloudinary automatically uploads and returns the URL
    res.json({
      message: 'Image uploaded successfully',
      imageUrl: req.file.path, // Cloudinary URL
      publicId: req.file.filename, // Cloudinary public ID
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ 
      message: 'Error uploading image', 
      error: error.message,
      stack: error.stack 
    });
  }
});

// GET all products (public route)
router.get('/', async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
});

// GET all products including inactive (admin only)
router.get('/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error('Error fetching all products:', error);
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
});

// GET single product by ID (public route)
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Error fetching product', error: error.message });
  }
});

// CREATE new product (admin only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, description, price, imageUrl, category, stock } = req.body;

    // Validation
    if (!title || !description || !price || !imageUrl || !category) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const product = new Product({
      title,
      description,
      price,
      imageUrl,
      category,
      stock: stock || 0,
    });

    await product.save();
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Error creating product', error: error.message });
  }
});

// UPDATE product (admin only)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, description, price, imageUrl, category, stock, isActive } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Update fields
    if (title !== undefined) product.title = title;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = price;
    if (imageUrl !== undefined) product.imageUrl = imageUrl;
    if (category !== undefined) product.category = category;
    if (stock !== undefined) product.stock = stock;
    if (isActive !== undefined) product.isActive = isActive;

    product.updatedAt = Date.now();
    await product.save();

    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Error updating product', error: error.message });
  }
});

// DELETE product (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Error deleting product', error: error.message });
  }
});

module.exports = router;
