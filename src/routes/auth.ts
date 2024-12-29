import express from 'express';
import { Router } from 'express';
import { downloadReel } from '../utils/instagram';

const router: Router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    // TODO: Implement user registration
    res.status(501).json({ message: "Not implemented yet" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    // TODO: Implement user login
    res.status(501).json({ message: "Not implemented yet" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});


router.get('/download-instagram', async (req, res) => {
  try {
    await downloadReel('https://www.instagram.com/reels/DDkNwnzz0yb/?next=%2F');
    res.json({ 
      message: 'Instagram automation completed successfully',
      success: true
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to process Instagram reels' });
  }
});

export default router; 