const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Check if Cloudinary credentials are set
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn('⚠️  WARNING: Cloudinary credentials not set in .env file!');
  console.warn('Please add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
  api_key: process.env.CLOUDINARY_API_KEY || 'demo',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'demo',
});

// Configure Multer Storage for Cloudinary - Products
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'barber-products', // Folder name in Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    transformation: [{ width: 800, height: 800, crop: 'limit' }], // Resize images
  },
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

// Configure Multer Storage for Team Members (Barbers)
const barberStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'barber-team', // Folder name in Cloudinary for team members
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }], // Optimized for profile pictures
  },
});

const uploadBarberImage = multer({ 
  storage: barberStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

module.exports = { cloudinary, upload, uploadBarberImage };
