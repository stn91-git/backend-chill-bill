import express from 'express';
import { Router } from 'express';
import { openInstagram } from '../utils/instagram';
import { postReelsToInstagram } from '../utils/instagram-poster';
import { loginToInstagram, getConversations, sendMessageToThread, startMessagePolling } from '../utils/instagram';

const router: Router = express.Router();

// Add this route to test Instagram automation
router.get('/download-instagram-reels', async (req, res) => {
    try {
       await openInstagram();
      res.json({ 
        message: 'Instagram automation completed successfully',
        success: true
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

// Login route that returns state
router.post('/login', async (req, res) => {
  try {
    const result = await loginToInstagram();
    if (result.success) {
      res.json({ 
        success: true, 
        state: result.state,
        message: 'Successfully logged in to Instagram'
      });
    } else {
      res.status(401).json({ 
        success: false, 
        message: 'Failed to login to Instagram'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error during Instagram login'
    });
  }
});

// Get conversations route that requires state in request body
router.post('/conversations', async (req, res) => {
  try {
    const { state } = req.body;
    if (!state) {
      return res.status(400).json({ 
        success: false, 
        message: 'Instagram state is required' 
      });
    }

    // Parse state if it's a string
    const parsedState = typeof state === 'string' ? JSON.parse(state) : state;

    const conversations = await getConversations(parsedState);
    res.json({ 
      success: true, 
      conversations 
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ 
      success: false, 
      message: error instanceof SyntaxError ? 'Invalid state format' : 'Error fetching conversations'
    });
  }
});

// Add route to send message to a conversation
router.post('/conversations/:threadId/messages', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { state, message } = req.body;

    if (!state || !message) {
      return res.status(400).json({
        success: false,
        message: 'Both state and message are required'
      });
    }

    // Parse state if it's a string
    const parsedState = typeof state === 'string' ? JSON.parse(state) : state;

    const result = await sendMessageToThread(parsedState, threadId, message);
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending message'
    });
  }
});

// Change from GET to POST to handle state in request body
router.post('/messages/stream', async (req, res) => {
  const { state } = req.body;
  
  if (!state) {
    return res.status(400).json({
      success: false,
      message: 'State is required in request body'
    });
  }

  try {
    // Parse state if it's a string
    const parsedState = typeof state === 'string' ? JSON.parse(state) : state;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const stopPolling = await startMessagePolling(parsedState, (messages) => {
      res.write(`data: ${JSON.stringify(messages)}\n\n`);
    });
    
    req.on('close', () => {
      stopPolling();
    });
  } catch (error) {
    console.error('Error in SSE stream:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting up message stream'
    });
  }
});

export default router;