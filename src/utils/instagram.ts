import puppeteer, { Page, Browser } from 'puppeteer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { IgApiClient } from 'instagram-private-api';
import { XMLParser } from 'fast-xml-parser';
const { igdl } = require('ruhend-scraper')

dotenv.config();

const ig = new IgApiClient();

export async function loginToInstagram() {
  ig.state.generateDevice(process.env.INSTAGRAM_USERNAME!);
  await ig.simulate.preLoginFlow();
  const loggedInUser = await ig.account.login(process.env.INSTAGRAM_USERNAME!, process.env.INSTAGRAM_PASSWORD!);
  const userFeed = ig.feed.user(loggedInUser.pk);
  const followersFeed = ig.feed.accountFollowers(loggedInUser.pk);
  const followers = await followersFeed.request();
  console.log(followers);

  
  // if (myPostsSecondPage[0].video_dash_manifest) {
  //   console.log('Downloading video from DASH manifest...');
  //   await downloadDashManifest(myPostsSecondPage[0].video_dash_manifest);
  // }
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
    // while (true) {
    //   try {
    //     const reelUrl = await waitForReelUrl(instagramPage)
    //     console.log('Reel URL:', reelUrl);
    //     // // Wait 5 seconds before next reel
    //       await downloadReel(reelUrl);
    //      await new Promise(r => setTimeout(r, 1000));
    //     await instagramPage.keyboard.press('ArrowDown');
    //   } catch (error) {
    //     console.error('Error processing reel:', error);
    //   }}
     
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

