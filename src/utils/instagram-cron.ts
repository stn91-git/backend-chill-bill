import cron from 'node-cron';
import { postReelsToInstagram } from './instagram-poster';

export function startInstagramCronJobs() {
    // Schedule for 9 AM
    cron.schedule('0 9 * * *', async () => {
        console.log('Running 9 AM Instagram post job');
        try {
            await postReelsToInstagram();
        } catch (error) {
            console.error('9 AM post failed:', error);
        }
    }, {
        timezone: "Asia/Kolkata" // IST timezone
    });

    // Schedule for 2 PM
    cron.schedule('0 14 * * *', async () => {
        console.log('Running 2 PM Instagram post job');
        try {
            await postReelsToInstagram();
        } catch (error) {
            console.error('2 PM post failed:', error);
        }
    }, {
        timezone: "Asia/Kolkata"
    });

    // Schedule for 5 PM
    cron.schedule('0 17 * * *', async () => {
        console.log('Running 5 PM Instagram post job');
        try {
            await postReelsToInstagram();
        } catch (error) {
            console.error('5 PM post failed:', error);
        }
    }, {
        timezone: "Asia/Kolkata"
    });

    // Schedule for 10 PM
    cron.schedule('0 22 * * *', async () => {
        console.log('Running 10 PM Instagram post job');
        try {
            await postReelsToInstagram();
        } catch (error) {
            console.error('10 PM post failed:', error);
        }
    }, {
        timezone: "Asia/Kolkata"
    });

    console.log('Instagram cron jobs scheduled');
} 