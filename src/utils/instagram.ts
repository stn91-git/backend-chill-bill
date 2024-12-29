import puppeteer, { Page, Browser } from 'puppeteer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { IgApiClient } from 'instagram-private-api';
import { XMLParser } from 'fast-xml-parser';
const { igdl } = require('ruhend-scraper')

dotenv.config();

const ig = new IgApiClient();

const STATE_FILE = path.join(__dirname, '../../instagram_state.json');

export async function downloadReel(videoUrl: string) {
  try {
    // Create uploads directory if it doesn't exist
    const uploadPath = path.resolve(__dirname, '../../uploads');
    await fs.mkdir(uploadPath, { recursive: true });

    // Download the file
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();

    // Generate unique filename using timestamp
    const timestamp = new Date().getTime();
    const filename = `reel_${timestamp}.mp4`;
    const filePath = path.join(uploadPath, filename);

    // Save the file
    await fs.writeFile(filePath, Buffer.from(buffer));
    console.log(`Downloaded reel to: ${filePath}`);

    return filePath;
  } catch (error) {
    console.error('Error downloading reel:', error);
    throw error;
  }
}


export async function postReelsToInstagram() {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    const username = process.env.INSTAGRAM_USERNAME_DIET_PEPSI;
    const password = process.env.INSTAGRAM_PASSWORD_DIET_PEPSI;

    if (!username || !password) {
      throw new Error('Instagram credentials not found in environment variables');
    }

    // Launch browser
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1280, height: 800 }
    });

    page = await browser.newPage();

    // Navigate to Instagram
    await page.goto('https://www.instagram.com');
    await page.waitForSelector('input[name="username"]');

    // Login
    await page.type('input[name="username"]', username);
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for login to complete
    await page.waitForNavigation();

    // Get list of videos in uploads directory
    const uploadsDir = path.resolve(__dirname, '../../uploads');
    const files = await fs.readdir(uploadsDir);
    const videoFiles = files.filter(file => file.endsWith('.mp4'));

    for (const videoFile of videoFiles) {
      try {
        // Click create new post button
        await page.waitForSelector('svg[aria-label="New post"]');
        await page.click('svg[aria-label="New post"]');

        // Wait for file input and upload video
        const filePath = path.join(uploadsDir, videoFile);
        const [fileChooser] = await Promise.all([
          page.waitForFileChooser(),
          page.click('button[type="button"]')
        ]);
        await fileChooser.accept([filePath]);

        // Wait for upload to complete
        await page.waitForSelector('button:has-text("Next")', { timeout: 60000 });
        await page.click('button:has-text("Next")');

        // Skip filters/editing
        await page.waitForSelector('button:has-text("Next")', { timeout: 30000 });
        await page.click('button:has-text("Next")');

        // Add caption if needed
        await page.waitForSelector('textarea[aria-label="Write a caption..."]');
        await page.type('textarea[aria-label="Write a caption..."]', '🎥 #reels #instagram');

        // Share the post
        await page.waitForSelector('button:has-text("Share")');
        await page.click('button:has-text("Share")');

        // Wait for post to complete
        await page.waitForSelector('div[role="dialog"] button:has-text("Close")');
        await page.click('div[role="dialog"] button:has-text("Close")');

        console.log(`Successfully posted video: ${videoFile}`);

        // Optional: Move posted video to a 'posted' directory
        const postedDir = path.join(uploadsDir, 'posted');
        await fs.mkdir(postedDir, { recursive: true });
        await fs.rename(filePath, path.join(postedDir, videoFile));

        // Wait between posts
        await new Promise(r => setTimeout(r, 10000));
      } catch (error) {
        console.error(`Error posting video ${videoFile}:`, error);
      }
    }

    return { success: true };

  } catch (error) {
    console.error('Error in postReelsToInstagram:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function downloadDashManifest(dashManifest: string) {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
    const parsed = parser.parse(dashManifest);
    
    // Get the video adaptation set
    let videoAdaptationSet;
    if (Array.isArray(parsed.MPD.Period.AdaptationSet)) {
      videoAdaptationSet = parsed.MPD.Period.AdaptationSet.find(
        (set: any) => set['@_contentType'] === 'video'
      );
    } else {
      // If AdaptationSet is not an array, check if it's the video one
      videoAdaptationSet = parsed.MPD.Period.AdaptationSet['@_contentType'] === 'video' 
        ? parsed.MPD.Period.AdaptationSet 
        : null;
    }

    if (!videoAdaptationSet) {
      throw new Error('No video adaptation set found in manifest');
    }

    // Get the highest quality video representation
    let videoRepresentations = Array.isArray(videoAdaptationSet.Representation) 
      ? videoAdaptationSet.Representation 
      : [videoAdaptationSet.Representation];

    // Sort by bandwidth to get highest quality
    const highestQualityVideo = videoRepresentations.sort(
      (a: any, b: any) => Number(b['@_bandwidth']) - Number(a['@_bandwidth'])
    )[0];

    if (!highestQualityVideo.BaseURL) {
      throw new Error('No BaseURL found in video representation');
    }

    // Get video URL
    const videoUrl = highestQualityVideo.BaseURL;
    console.log('Downloading from URL:', videoUrl);

    // Create uploads directory if it doesn't exist
    const uploadPath = path.resolve(__dirname, '../../uploads');
    await fs.mkdir(uploadPath, { recursive: true });

    // Download the video
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();

    // Generate unique filename
    const timestamp = new Date().getTime();
    const filename = `reel_${timestamp}.mp4`;
    const filePath = path.join(uploadPath, filename);

    // Save the file
    await fs.writeFile(filePath, Buffer.from(buffer));
    console.log(`Downloaded reel to: ${filePath}`);
    
    return filePath;
  } catch (error) {
    console.error('Error downloading DASH manifest:', error);
    console.error('Manifest content:', dashManifest);
    throw error;
  }
}

export async function sendDirectMessage(userId: string , message: string) {
  try {
    // Try to load session if not already loaded
    if (!ig.state.deviceString) {
      await loginToInstagram();
    }

    const thread = ig.entity.directThread([userId.toString()]);
    await thread.broadcastText(message);
    console.log(`Message sent to user ${userId}`);
    return true;
  } catch (error) {
    console.error('Error sending direct message:', error);
    throw error;
  }
}

// Add this function to fetch messages from a conversation
export async function getDirectMessages(userId: string | number) {
  try {
    // Use directThread as a feed directly
    
    const thread = ig.feed.directThread({ thread_id: userId.toString(), oldest_cursor: '' });
    const messages = await thread.items();
    
    // Process messages
    const processedMessages = messages.map(message => ({
      id: message.item_id,
      timestamp: message.timestamp,
      text: message.text || null,
      type: message.item_type,
      userId: message.user_id,
      // isFromMe: message.user_id === ig.state.cookieUserId
    }));

    console.log(`Retrieved ${messages.length} messages from conversation with user ${userId}`);
    return processedMessages;
  } catch (error) {
    console.error('Error fetching direct messages:', error);
    throw error;
  }
}

// Optional: Add function to get all conversations
export async function getAllConversations() {
  try {
    const inbox = ig.feed.directInbox();
    const threads = await inbox.items();
    
    return threads.map(thread => ({
      threadId: thread.thread_id,
      users: thread.users,
      lastMessage: thread.last_permanent_item
    }));
  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }
}

// Add this function to listen for new messages
export async function listenForNewMessages(callback: (message: any) => void) {
  let lastMessageId: string | null = null;
  
  // Check for new messages every 5 seconds
  const interval = setInterval(async () => {
    try {
      const inbox = ig.feed.directInbox();
      const threads = await inbox.items();
      
      for (const thread of threads) {
        const lastMessage = thread.last_permanent_item;
        
        // If we have a new message
        if (lastMessage && lastMessage.item_id !== lastMessageId) {
          lastMessageId = lastMessage.item_id;
          
          const processedMessage = {
            threadId: thread.thread_id,
            userId: lastMessage.user_id,
            text: lastMessage.text || null,
            timestamp: lastMessage.timestamp,
            type: lastMessage.item_type,
           // isFromMe: lastMessage.user_id === ig.state.cookieUserId
          };
          
          callback(processedMessage);
        }
      }
    } catch (error) {
      console.error('Error checking for new messages:', error);
    }
  }, 5000); // 5 second interval

  // Return function to stop listening
  return () => clearInterval(interval);
}

export async function searchFollowing(searchTerm: string) {
  try {
    // First login if not already logged in
    ig.state.generateDevice(process.env.INSTAGRAM_USERNAME!);
    await ig.simulate.preLoginFlow();
    const loggedInUser = await ig.account.login(process.env.INSTAGRAM_USERNAME!, process.env.INSTAGRAM_PASSWORD!);
    
    // After successful login, create thread and send message
    try {
      console.log('Attempting to send message...');
      const thread = ig.entity.directThread(['5575899032']);
      await thread.broadcastText('hi');
      console.log('Message sent successfully');
    } catch (msgError) {
      console.error('Error sending message:', msgError);
    }
    
    // Get following feed
    const followingFeed = ig.feed.accountFollowing(loggedInUser.pk);
    const following = await followingFeed.items();
    
    // Search through following
    const matchedUsers = following.filter(user => 
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return matchedUsers.map(user => ({
      pk: user.pk,
      username: user.username,
      fullName: user.full_name,
      isPrivate: user.is_private,
      profilePicUrl: user.profile_pic_url
    }));

  } catch (error) {
    console.error('Error in searchFollowing:', error);
    throw error;
  }
}
// (async () => {
//   try {
//     console.log('Searching for user...');
//     const results = await searchFollowing('aditya_hazarika_101');
//     console.log('Search results:', results);
//   } catch (error) {
//     console.error('Error searching for user:', error);
//   }
// })();

// (async () => {
//   try {
//     console.log('Sending message...');
//     await sendDirectMessage('5575899032', 'hi');
//     console.log('Message sent successfully');
//   } catch (error) {
//     console.error('Error sending message:', error);
//   }
// })();

// Add this new function to save and load session state
export async function loginToInstagram(): Promise<{ success: boolean, state: any }> {
  try {
    ig.state.generateDevice(process.env.INSTAGRAM_USERNAME!);
    await ig.simulate.preLoginFlow();
    const loggedInUser = await ig.account.login(process.env.INSTAGRAM_USERNAME!, process.env.INSTAGRAM_PASSWORD!);
    
    // Return the serialized state instead of saving it
    const serialized = await ig.state.serialize();
    return { success: true, state: serialized };

  } catch (error) {
    console.error('Login error:', error);
    return { success: false, state: null };
  }
}

// Add function to get conversations that accepts state
export async function getConversations(state: any) {
  try {
    // Deserialize the state
    await ig.state.deserialize(state);
    
    // Get inbox feed
    const inbox = ig.feed.directInbox();
    const threads = await inbox.items();
    console.log(threads.length);
    
    // Process and return conversations
    return threads.map(thread => ({
      threadId: thread.thread_id,
      users: thread.users.map(user => ({
        pk: user.pk,
        username: user.username,
        fullName: user.full_name,
        profilePic: user.profile_pic_url
      })),
      lastMessage: {
        text: thread.last_permanent_item.text,
        timestamp: thread.last_permanent_item.timestamp,
        senderId: thread.last_permanent_item.user_id
      },
      isGroup: thread.is_group
    }));

  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }
}
// (async () => {
//   await sendDirectMessage('5575899032', 'hi');
// })();

// Add this function to send message using state
export async function sendMessageToThread(state: any, userId: string, message: string) {
  try {
    // Deserialize the state
    await ig.state.deserialize(state);
    
    // Create thread instance with user ID and send message
    const thread = ig.entity.directThread(["3583277974","5575899032"]); // Ensure userId is string
    const result = await thread.broadcastText(message);
    console.log('Message sent:', result);
    
    return {
      success: true,
      userId,
      message,
      timestamp: Date.now()
    };

  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

interface Message {
  id: string;
  text: string | null;
  timestamp: number;
  userId: number;
  threadId: string;
}

export async function startMessagePolling(state: any, callback: (messages: Message[]) => void, interval = 5000) {
  let lastCheckedTimestamp = Date.now() / 1000;
  
  const checkNewMessages = async () => {
    try {
      await ig.state.deserialize(state);
      const inbox = ig.feed.directInbox();
      const threads = await inbox.items();
      
      const newMessages: Message[] = [];
      
      for (const thread of threads) {
        const messages = await ig.feed.directThread({
          thread_id: thread.thread_id,
          oldest_cursor: ''
        }).items();
        
        messages.forEach(msg => {
          const msgTimestamp = Number(msg.timestamp);
          // Only add messages that have text content and are new
          if (msgTimestamp > lastCheckedTimestamp && msg.text && msg.text.trim() !== '') {
            newMessages.push({
              id: msg.item_id,
              text: msg.text,
              timestamp: msgTimestamp,
              userId: msg.user_id,
              threadId: thread.thread_id
            });
          }
        });
      }
      
      if (newMessages.length > 0) {
        callback(newMessages);
        lastCheckedTimestamp = Date.now() / 1000;
      }
      
    } catch (error) {
      console.error('Error polling messages:', error);
    }
  };

  const pollInterval = setInterval(checkNewMessages, interval);
  return () => clearInterval(pollInterval);
}
