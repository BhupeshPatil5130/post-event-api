require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*'
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI , {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Project Model
const ProjectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  coverImageUrl: { type: String },
  coverImagePath: { type: String }, // For local storage
  liveLink: { type: String },
  description: { type: String, required: true },
  techStack: { type: [String] },
  price: { type: String },
  details: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Project = mongoose.model('Project', ProjectSchema);

// Multer Configuration for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'project-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif)'));
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
}).single('coverImage');

// Helper function to handle file upload
const handleFileUpload = (req, res) => {
  return new Promise((resolve, reject) => {
    upload(req, res, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(req.file);
      }
    });
  });
};

// Routes
app.post('/api/projects/create', async (req, res) => {
  try {
    let coverImageUrl = '';
    let coverImagePath = '';

    // Check if we're receiving a file upload or a URL
    if (req.headers['content-type']?.startsWith('multipart/form-data')) {
      // Handle file upload
      try {
        const file = await handleFileUpload(req, res);
        if (file) {
          coverImagePath = `/uploads/${file.filename}`;
          coverImageUrl = `${req.protocol}://${req.get('host')}${coverImagePath}`;
        }
      } catch (fileError) {
        return res.status(400).json({ error: fileError.message });
      }
    }

    // Get other form data (either from multipart or JSON)
    const formData = req.headers['content-type']?.startsWith('multipart/form-data') 
      ? JSON.parse(req.body.data) 
      : req.body;

    // If no file was uploaded but URL was provided
    if (!coverImageUrl && formData.coverImageUrl) {
      coverImageUrl = formData.coverImageUrl;
    }

    // Create new project
    const project = new Project({
      title: formData.title,
      coverImageUrl: coverImageUrl,
      coverImagePath: coverImagePath,
      liveLink: formData.liveLink,
      description: formData.description,
      techStack: formData.techStack || [],
      price: formData.price,
      details: formData.details
    });

    await project.save();

    res.status(201).json({
      message: 'Project created successfully',
      project: project
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all projects
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});
