import puppeteer from 'puppeteer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export async function openInstagram() {
  try {
    const username = process.env.INSTAGRAM_USERNAME;
    const password = process.env.INSTAGRAM_PASSWORD;

    if (!username || !password) {
      throw new Error('Instagram credentials not found in environment variables');
    }

    // Launch the browser
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1280, height: 800 }
    });

    // Create a new page
    const page = await browser.newPage();

    // Navigate to Instagram
    await page.goto('https://www.instagram.com', {
      waitUntil: 'networkidle0',
    });

    // Wait for the login form
    await page.waitForSelector('._aa4b', { timeout: 5000 });

    // Type username
    await page.type('input[name="username"]', username);
    
    // Type password
    await page.type('input[type="password"]', password);

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForNavigation({
      waitUntil: 'networkidle0',
    });

    // Wait for the reels link to be visible and click it
    await page.waitForSelector('a[href="/reels/?next=%2F"]');
    await page.click('a[href="/reels/?next=%2F"]');

    // Wait for reels page to load
    await page.waitForNavigation({
      waitUntil: 'networkidle0',
    });

    console.log('Successfully navigated to reels section');

    return { browser, page };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
} 