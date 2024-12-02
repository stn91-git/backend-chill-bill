import express from 'express';
import { Router } from 'express';
import { db } from '../config/firebase';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import multer from 'multer';
import path from 'path';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";

const router: Router = express.Router();

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// POST /api/rooms/create
router.post('/create', async (req, res) => {
  try {
    const { roomName, name, upiId } = req.body;

    // Create user document
    const userRef = await db.collection('users').add({
      name,
      upiId,
      createdAt: FieldValue.serverTimestamp()
    });

    // Create room document with current timestamp for array
    const now = Timestamp.now();
    const roomRef = await db.collection('rooms').add({
      name: roomName,
      creator: userRef.id,
      participants: [{
        userId: userRef.id,
        name,
        upiId,
        joinedAt: now
      }],
      isActive: true,
      createdAt: FieldValue.serverTimestamp()
    });

    // Get the created room data
    const roomDoc = await roomRef.get();
    const roomData = roomDoc.data();
    const creatorDoc = await userRef.get();
    const creatorData = creatorDoc.data();

    res.status(201).json({
      message: 'Room created successfully',
      room: {
        id: roomRef.id,
        name: roomData?.name,
        creator: {
          id: userRef.id,
          name: creatorData?.name,
          upiId: creatorData?.upiId
        },
        joinLink: `${process.env.CLIENT_URL || 'http://localhost:3000'}/rooms/join/${roomRef.id}`
      }
    });
  } catch (error) {
    console.error('Room creation error:', error);
    res.status(500).json({ message: "Failed to create room" });
  }
});

// POST /api/rooms/join/:roomId
router.post('/join/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { name, upiId } = req.body;

    // Validate input
    if (!name || !upiId) {
      return res.status(400).json({ message: "Name and UPI ID are required" });
    }

    // Check if room exists
    const roomRef = db.collection('rooms').doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return res.status(404).json({ message: "Room not found" });
    }

    const roomData = roomDoc.data();
    
    // Check if room is active
    if (!roomData?.isActive) {
      return res.status(400).json({ message: "This room is no longer active" });
    }

    // Check if user with same name already exists in room
    const existingParticipant = roomData.participants.find(
      (p: any) => p.name.toLowerCase() === name.toLowerCase()
    );
    if (existingParticipant) {
      return res.status(400).json({ message: "A user with this name already exists in the room" });
    }

    // Create user
    const userRef = await db.collection('users').add({
      name,
      upiId,
      createdAt: FieldValue.serverTimestamp()
    });

    // Add user to room participants with current timestamp
    const now = Timestamp.now();
    await roomRef.update({
      participants: [...(roomData.participants || []), {
        userId: userRef.id,
        name,
        upiId,
        joinedAt: now
      }]
    });

    // Get updated room data
    const updatedRoomDoc = await roomRef.get();
    const updatedRoomData = updatedRoomDoc.data();
    const creatorDoc = await db.collection('users').doc(roomData?.creator).get();
    const creatorData = creatorDoc.data();

    res.status(200).json({
      message: 'Joined room successfully',
      room: {
        id: roomId,
        name: updatedRoomData?.name,
        creator: {
          id: roomData?.creator,
          name: creatorData?.name,
          upiId: creatorData?.upiId
        },
        participants: await Promise.all((updatedRoomData?.participants || []).map(async (p: any) => {
          const userDoc = await db.collection('users').doc(p.userId).get();
          const userData = userDoc.data();
          return {
            id: p.userId,
            name: userData?.name,
            upiId: userData?.upiId,
            joinedAt: p.joinedAt.toDate()
          };
        }))
      }
    });
  } catch (error) {
    console.error('Room joining error:', error);
    res.status(500).json({ message: "Failed to join room" });
  }
});

// GET /api/rooms/:roomId
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    if (!roomId) {
      return res.status(400).json({ message: 'Room ID is required' });
    }

    const roomRef = db.collection('rooms').doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const roomData = roomDoc.data();
    const creatorDoc = await db.collection('users').doc(roomData?.creator).get();
    const creatorData = creatorDoc.data();

    // Format participants data
    const participants = await Promise.all((roomData?.participants || []).map(async (p: any) => {
      return {
        userId: p.userId,
        name: p.name,
        upiId: p.upiId,
        joinedAt: p.joinedAt.toDate().toISOString()
      };
    }));

    // Format the response
    const room = {
      id: roomDoc.id,
      name: roomData?.name,
      creator: {
        id: roomData?.creator,
        name: creatorData?.name,
        upiId: creatorData?.upiId
      },
      isActive: roomData?.isActive || false,
      participants: participants,
      receipt: roomData?.receipt || null
    };

    res.json({ room });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ message: 'Failed to fetch room details' });
  }
});

// Update the upload-receipt route
router.post('/:roomId/upload-receipt', upload.single('receipt'), async (req, res) => {
  try {
    const { roomId } = req.params;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const apiKey = "AIzaSyBuaRPl9QtBKDVsyaW9TxOHh1UD8wFqHUs";
    const genAI = new GoogleGenerativeAI(apiKey);
    const fileManager = new GoogleAIFileManager(apiKey);

    // Upload file to Gemini
    const uploadResult = await fileManager.uploadFile(file.path, {
      mimeType: file.mimetype,
      displayName: file.filename,
    });

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const chatSession = model.startChat({
      generationConfig: {
        temperature: 1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: "text/plain",
      },
    });

    const result = await chatSession.sendMessage([
      {
        fileData: {
          mimeType: uploadResult.file.mimeType,
          fileUri: uploadResult.file.uri,
        },
      },
      {
        text: "This is a receipt of a resto bar, you have to identify the items for people to split the bills. Return a json format for it",
      },
    ]);

    const response = result.response.text();
    const jsonStr = response.replace(/```json\n|\n```/g, '');
    const receiptData = JSON.parse(jsonStr);

    // Initialize tags array for each item
    receiptData.items = receiptData.items.map((item: any) => ({
      ...item,
      tags: []
    }));

    // Store receipt data in Firestore
    const roomRef = db.collection('rooms').doc(roomId);
    await roomRef.update({
      receipt: receiptData,
      updatedAt: FieldValue.serverTimestamp()
    });

    res.json(receiptData);
  } catch (error) {
    console.error('Receipt processing error:', error);
    res.status(500).json({ message: 'Failed to process receipt' });
  }
});

// Add new route for updating item tags
router.post('/:roomId/items/:itemIndex/tags', async (req, res) => {
  try {
    const { roomId, itemIndex } = req.params;
    const { userId, action } = req.body;

    console.log("Received tag request:", { roomId, itemIndex, userId, action }); // Debug log

    const roomRef = db.collection('rooms').doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return res.status(404).json({ message: "Room not found" });
    }

    const roomData = roomDoc.data();
    if (!roomData?.receipt?.items) {
      return res.status(404).json({ message: "No receipt found in this room" });
    }

    // Create a deep copy of receipt data
    const receipt = JSON.parse(JSON.stringify(roomData.receipt));
    
    if (!receipt.items[itemIndex]) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Ensure tags array exists
    if (!Array.isArray(receipt.items[itemIndex].tags)) {
      receipt.items[itemIndex].tags = [];
    }

    if (action === 'add' && userId) {
      // Add user to tags if not already tagged
      if (!receipt.items[itemIndex].tags.includes(userId)) {
        receipt.items[itemIndex].tags.push(userId);
      }
    } else if (action === 'remove' && userId) {
      // Remove user from tags
      receipt.items[itemIndex].tags = receipt.items[itemIndex].tags.filter(
        (id: string) => id !== userId
      );
    }

    // Update the entire receipt object
    await roomRef.update({
      receipt: receipt,
      updatedAt: FieldValue.serverTimestamp()
    });

    console.log("Updated receipt:", receipt); // Debug log

    res.json({ 
      success: true, 
      items: receipt.items 
    });
  } catch (error) {
    console.error('Tag update error:', error);
    res.status(500).json({ message: "Failed to update tags" });
  }
});

export default router; 