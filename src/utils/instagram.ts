import puppeteer, { Page, Browser } from 'puppeteer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
const { igdl } = require('ruhend-scraper')

dotenv.config();

// Add helper function to handle ads
async function handleAds(page: Page) {
  const pages = await page.browser().pages();
  // Close any additional pages (ads) except the main page and Instagram page
  for (const p of pages) {
    if (p !== page && !p.url().includes('instagram.com')) {
      await p.close();
    }
  }
}

// Replace all instances of page._client.send with the proper CDP session
async function setupDownloadBehavior(page: Page, downloadPath: string) {
  const client = await page.createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath
  });
}

export async function downloadReel(reelUrl: string) {
  let res = await igdl(reelUrl);
  let data = await res.data;
  for (let media of data) {
    try {
      // Create uploads directory if it doesn't exist
      const uploadPath = path.resolve(__dirname, '../../uploads');
      await fs.mkdir(uploadPath, { recursive: true });

      // Download the file
      const response = await fetch(media.url);
      const buffer = await response.arrayBuffer();

      // Generate unique filename using timestamp
      const timestamp = new Date().getTime();
      const filename = `reel_${timestamp}.mp4`;
      const filePath = path.join(uploadPath, filename);

      // Save the file
      await fs.writeFile(filePath, Buffer.from(buffer));
      console.log(`Downloaded reel to: ${filePath}`);

      // Wait 2 seconds before next download
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('Error downloading reel:', error);
    }
  }
}

export async function openInstagram() {


  let browser: Browser | null = null;
  let instagramPage: Page | null = null;
  // Track downloaded reels
  const downloadedReels = new Set<string>();

  try {
    const username = process.env.INSTAGRAM_USERNAME;
    const password = process.env.INSTAGRAM_PASSWORD;

    if (!username || !password) {
      throw new Error('Instagram credentials not found in environment variables');
    }

    // Configure browser with download preferences
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1280, height: 800 }
    });

    // Configure download behavior for all pages
    // const uploadPath = path.resolve(__dirname, '../../uploads');
    const client = await browser.createIncognitoBrowserContext();
    
    instagramPage = await client.newPage();
    // await setupDownloadBehavior(instagramPage, uploadPath);

    // Navigate to Instagram
    await instagramPage.goto('https://www.instagram.com');

    // Wait for login form and login
    await instagramPage.waitForSelector('input[name="username"]');
    await instagramPage.type('input[name="username"]', username);
    await instagramPage.type('input[type="password"]', password);
    await instagramPage.click('button[type="submit"]');

    // Wait for home page to load
    await instagramPage.waitForSelector('a[href="/reels/?next=%2F"]');
    await instagramPage.click('a[href="/reels/?next=%2F"]');

    // Wait for reels to load before proceeding
    await waitForReelsToLoad(instagramPage);

    console.log('Successfully navigated to reels section');
    while (true) {
      try {
        const reelUrl = await waitForReelUrl(instagramPage)
        console.log('Reel URL:', reelUrl);
        // // Wait 5 seconds before next reel
        await downloadReel(reelUrl);
        await new Promise(r => setTimeout(r, 5000));
        await instagramPage.keyboard.press('ArrowDown');
      } catch (error) {
        console.error('Error processing reel:', error);
      }}
     
    // Function to wait for proper reel URL
    async function waitForReelUrl(page: Page): Promise<string> {
      let currentUrl = '';
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max wait time
      const reelUrlPattern = /https:\/\/www\.instagram\.com\/reels\/[A-Za-z0-9_-]+\//;

      while (attempts < maxAttempts) {
        currentUrl = page.url();
        
        // Check if URL matches the reel pattern
        if (reelUrlPattern.test(currentUrl)) {
          console.log('Valid reel URL found:', currentUrl);
          return currentUrl;
        }

        console.log('Waiting for reels to load...', currentUrl);
        await new Promise(r => setTimeout(r, 1000));
        attempts++;
      }

      throw new Error('Timeout waiting for valid reel URL');
    }

    // Function to check if reels are loaded
    async function waitForReelsToLoad(page: Page) {
      console.log('Waiting for reels feed to load...');
      
      // Wait for video elements to be present
      await page.waitForSelector('video', { timeout: 30000 });
      
      // Additional wait to ensure content is properly loaded
      await new Promise(r => setTimeout(r, 5000));
      
      console.log('Reels feed loaded successfully');
    }

    return { success: true };

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
} 

