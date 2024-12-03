import puppeteer, { Page } from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config();

export async function openInstagram() {
  try {
    const username = process.env.INSTAGRAM_USERNAME;
    const password = process.env.INSTAGRAM_PASSWORD;

    if (!username || !password) {
      throw new Error('Instagram credentials not found in environment variables');
    }

    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1280, height: 800 }
    });

    const page = await browser.newPage();

    // Navigate to Instagram
    await page.goto('https://www.instagram.com');

    // Wait for login form and login
    await page.waitForSelector('input[name="username"]');
    await page.type('input[name="username"]', username);
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for home page to load
    await page.waitForSelector('a[href="/reels/?next=%2F"]');
    await page.click('a[href="/reels/?next=%2F"]');

    console.log('Successfully navigated to reels section');

    // Function to wait for proper reel URL
    async function waitForReelUrl(page: Page): Promise<string> {
      let currentUrl = '';
      while (currentUrl.includes('accounts/onetap') || !currentUrl.includes('/reels/')) {
        currentUrl =  page.url();
        await new Promise(r => setTimeout(r, 1000));
      }
      return currentUrl;
    }

    // Function to download current reel
    async function downloadReel() {
      try {
        // Wait for proper reel URL
        const reelUrl = await waitForReelUrl(page);
        
        if (reelUrl.includes('/reels/')) {
          const reelId = reelUrl.split('/reels/')[1].split('/?')[0];
          console.log('Found Reel ID:', reelId);
          console.log('Reel URL:', reelUrl);
          
          // Here you can add your download logic using the reelId
          // For example: await downloadFromInstagram(reelUrl);
        }

        // Move to next reel
        await page.keyboard.press('ArrowDown');
        await new Promise(r => setTimeout(r, 4000));

      } catch (error) {
        console.error('Error getting reel URL:', error);
      }
    }

    // Process first 5 reels
    for (let i = 0; i < 5; i++) {
      console.log(`Processing reel ${i + 1}`);
      await downloadReel();
      await new Promise(r => setTimeout(r, 2000)); // Small delay between reels
    }

    console.log('Finished processing reels');
    await browser.close();

    return { success: true };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
} 