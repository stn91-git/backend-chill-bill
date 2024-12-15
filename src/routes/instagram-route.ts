import express from 'express';
import { Router } from 'express';
import { openInstagram } from '../utils/instagram';
import { postReelsToInstagram } from '../utils/instagram-poster';

const router: Router = express.Router();

// Add this route to test Instagram automation
router.get('/download-instagram-reels', async (req, res) => {
    try {
      const { success } = await openInstagram();
      res.json({ 
        message: 'Instagram automation completed successfully',
        success
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ message: 'Failed to process Instagram reels' });
    }
  });

// Add new route to post reels
router.get('/post-reels', async (req, res) => {
  try {
    const result = await postReelsToInstagram();
    res.json({ 
      message: 'Successfully posted reels to Instagram',
      success: true
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to post reels to Instagram' });
  }
});

export default router;