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
        joinedAt: now // Use regular timestamp for array element
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

    // Check if room exists
    const roomRef = db.collection('rooms').doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return res.status(404).json({ message: "Room not found" });
    }

    const roomData = roomDoc.data();
    if (!roomData?.isActive) {
      return res.status(400).json({ message: "This room is no longer active" });
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
        joinedAt: now // Use regular timestamp for array element
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

    const roomRef = db.collection('rooms').doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return res.status(404).json({ message: "Room not found" });
    }

    const roomData = roomDoc.data();
    const creatorDoc = await db.collection('users').doc(roomData?.creator).get();
    const creatorData = creatorDoc.data();

    res.status(200).json({
      room: {
        id: roomId,
        name: roomData?.name,
        creator: {
          id: roomData?.creator,
          name: creatorData?.name,
          upiId: creatorData?.upiId
        },
        participants: await Promise.all((roomData?.participants || []).map(async (p: any) => {
          const userDoc = await db.collection('users').doc(p.userId).get();
          const userData = userDoc.data();
          return {
            id: p.userId,
            name: userData?.name,
            upiId: userData?.upiId,
            joinedAt: p.joinedAt.toDate()
          };
        })),
        isActive: roomData?.isActive
      }
    });
  } catch (error) {
    console.error('Room fetch error:', error);
    res.status(500).json({ message: "Failed to fetch room details" });
  }
});

// Add this route to handle receipt uploads
router.post('/:roomId/upload-receipt', upload.single('receipt'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const apiKey = "AIzaSyBuaRPl9QtBKDVsyaW9TxOHh1UD8wFqHUs"
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

    // Send the image to Gemini with prompt
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
    // Extract JSON from the response (remove markdown formatting if present)
    const jsonStr = response.replace(/```json\n|\n```/g, '');
    const receiptData = JSON.parse(jsonStr);
    console.log(receiptData);
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
    const { userId, action } = req.body; // action can be 'add' or 'remove'

    const roomRef = db.collection('rooms').doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return res.status(404).json({ message: "Room not found" });
    }

    const roomData = roomDoc.data();
    if (!roomData?.receipt?.items) {
      return res.status(404).json({ message: "No receipt found in this room" });
    }

    const items = roomData.receipt.items;
    if (!items[itemIndex]) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Initialize tags array if it doesn't exist
    if (!items[itemIndex].tags) {
      items[itemIndex].tags = [];
    }

    if (action === 'add') {
      // Add user to tags if not already tagged
      if (!items[itemIndex].tags.includes(userId)) {
        items[itemIndex].tags.push(userId);
      }
    } else if (action === 'remove') {
      // Remove user from tags
      items[itemIndex].tags = items[itemIndex].tags.filter((id: string) => id !== userId);
    }

    // Update the room document
    await roomRef.update({
      'receipt.items': items
    });

    res.json({ success: true, items });
  } catch (error) {
    console.error('Tag update error:', error);
    res.status(500).json({ message: "Failed to update tags" });
  }
});

export default router; 