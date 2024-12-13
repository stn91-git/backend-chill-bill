import puppeteer, { Page, Browser } from 'puppeteer';
import dotenv from 'dotenv';
import path from 'path';

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
    const uploadPath = path.resolve(__dirname, '../../uploads');
    const client = await browser.createIncognitoBrowserContext();
    
    instagramPage = await client.newPage();
    await setupDownloadBehavior(instagramPage, uploadPath);

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

    // Function to download current reel
    async function downloadReel() {
      try {
        if (!browser || !instagramPage) return;

        const reelUrl = await waitForReelUrl(instagramPage);
        
        if (reelUrl.includes('/reels/')) {
          const reelId = reelUrl.split('/reels/')[1].split('/?')[0];
          console.log('Found Reel ID:', reelId);
          console.log('Reel URL:', reelUrl);
          
          const downloadPage = await client.newPage();
          // Configure download behavior for this page
          await setupDownloadBehavior(downloadPage, uploadPath);

          await downloadPage.goto('https://sssinstagram.com/reels-downloader');
          
          // Wait for input field
          const inputSelector = 'input.form__input';
          await downloadPage.waitForSelector(inputSelector);
          
          // Clear the input field first
          await downloadPage.evaluate((selector) => {
            const input = document.querySelector(selector) as HTMLInputElement;
            input.value = '';
          }, inputSelector);
          
          // Click the input field and paste URL
          await downloadPage.click(inputSelector);
          await downloadPage.keyboard.type(reelUrl);
          
          // Ensure URL is properly pasted before proceeding
          const inputValue = await downloadPage.$eval(inputSelector, 
            (el: HTMLInputElement) => el.value
          );
          
          if (inputValue !== reelUrl) {
            console.error('URL not properly pasted, retrying...');
            return;
          }
          
          // Click the initial submit button
          await downloadPage.click('button.form__submit');
          
          // Wait for the reel to load and the download button to appear
          await downloadPage.waitForSelector('a.button.button--filled.button__download', 
            { visible: true, timeout: 30000 }
          );
          
          // Handle any popup ads that might appear
          await handleAds(downloadPage);
          
          // Click the download button that appears after loading
          const downloadButton = await downloadPage.$('a.button.button--filled.button__download');
          if (downloadButton) {
            // Get the download URL
            const downloadUrl = await downloadPage.$eval(
              'a.button.button--filled.button__download',
              (el) => el.getAttribute('href')
            );

            if (!downloadUrl) {
              console.error('Download URL not found');
              await downloadPage.close();
              return false;
            }

            const downloadPromise = new Promise(resolve => {
              downloadPage.on('download', async (download) => {
               // await download.path();
               console.log('Download started',download);
                resolve(true);
              });
            });

            await Promise.all([
              downloadPromise,
              downloadButton.click()
            ]);
            
            // Wait for download to complete
            await new Promise(r => setTimeout(r, 5000));
            
            // Close only the download tab
            await downloadPage.close();
            
            console.log(`Successfully downloaded reel: ${reelId} to uploads folder`);

            // Only move to next reel after successful download
            await instagramPage.keyboard.press('ArrowDown');
            await new Promise(r => setTimeout(r, 4000));
            
            return true;
          } else {
            console.error('Download button not found');
            await downloadPage.close();
            return false;
          }
        }
      } catch (error) {
        console.error('Error downloading reel:', error);
        return false;
      }
    }

    // Process reels with retry logic
    for (let i = 0; i < 5; i++) {
      console.log(`Processing reel ${i + 1}`);
      let success = false;
      let attempts = 0;
      const maxAttempts = 3;

      while (!success && attempts < maxAttempts) {
        attempts++;
        console.log(`Attempt ${attempts} for reel ${i + 1}`);
       await downloadReel();
          await new Promise(r => setTimeout(r, 9000)); // Wait before retry
        
      }

      if (!success) {
        console.error(`Failed to download reel ${i + 1} after ${maxAttempts} attempts`);
      }
    }

    console.log('Finished processing reels');
    return { success: true };

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
} 