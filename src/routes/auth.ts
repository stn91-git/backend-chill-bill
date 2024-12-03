import express from 'express';
import { Router } from 'express';
import { openInstagram } from '../utils/instagram';

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

// Add this route to test Instagram automation
router.get('/test-instagram', async (req, res) => {
  try {
    const { browser, page } = await openInstagram();
    
    // Close the browser after 5 seconds (for testing)
    // setTimeout(async () => {
    //   await browser.close();
    // }, 5000);

    res.json({ message: 'Instagram opened successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to open Instagram' });
  }
});

export default router; 