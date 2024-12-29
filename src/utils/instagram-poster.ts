import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { IgApiClient } from 'instagram-private-api';
import { readFile, existsSync } from 'fs';
import { promisify } from 'util';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const readFileAsync = promisify(readFile);
const ig = new IgApiClient();

async function login() {
    const stateFile = path.join(__dirname, '../../instagram_state.json');
    
    try {
        // Check if state file exists
        if (existsSync(stateFile)) {
            console.log('Found existing state file, using saved session');
            const savedState = JSON.parse(await fs.readFile(stateFile, 'utf8'));
            await ig.state.deserialize(savedState);
            
            // Verify the session is still valid
            const user = await ig.account.currentUser();
            console.log('Session valid, logged in as:', user.username);
            return user;
        }
        
        // If no state file or invalid session, do fresh login
        console.log('No valid state file found, performing fresh login');
        ig.state.generateDevice(process.env.INSTAGRAM_USERNAME_DIET_PEPSI!);
        await ig.simulate.preLoginFlow();
        const loggedInUser = await ig.account.login(
            process.env.INSTAGRAM_USERNAME_DIET_PEPSI!,
            process.env.INSTAGRAM_PASSWORD_DIET_PEPSI!
        );
        
        // Save the state after successful login
        const serialized = await ig.state.serialize();
        await fs.writeFile(stateFile, JSON.stringify(serialized));
        console.log('Saved new session state to file');
        
        return loggedInUser;
    } catch (error) {
        console.error('Login error:', error);
        // If anything fails, delete state file and throw error
        if (existsSync(stateFile)) {
            await fs.unlink(stateFile);
            console.log('Deleted invalid state file');
        }
        throw error;
    }
}

export async function postReelsToInstagram() {
    try {
        if (!process.env.INSTAGRAM_USERNAME_DIET_PEPSI || !process.env.INSTAGRAM_PASSWORD_DIET_PEPSI) {
            throw new Error('Instagram credentials not found in environment variables');
        }

        // Login first
        const loggedInUser = await login();
        console.log('Logged in as:', loggedInUser.username);

        // Get video file
        const uploadsDir = path.resolve(__dirname, '../../uploads');
        const files = await fs.readdir(uploadsDir);
        const videoFiles = files.filter(file => file.endsWith('.mp4'));

        if (videoFiles.length === 0) {
            throw new Error('No videos found in uploads directory');
        }

        const videoPath = path.join(uploadsDir, videoFiles[0]);
        const coverPath = path.join(__dirname, '../bryan-dijkhuizen-Prg_UfDpfeQ-unsplash.jpg');
        
        console.log('Publishing video:', videoPath);
        console.log('Using cover image:', coverPath);

        // Publish video
        const publishResult = await ig.publish.video({
            video: await readFileAsync(videoPath),
            coverImage: await readFileAsync(coverPath),
            caption: "Your caption here..."
        });

        console.log('Upload result:', publishResult);
        
        // Clean up after successful upload
        await fs.unlink(videoPath);
        
        return publishResult;
    } catch (error) {
        console.error('Error in postReelsToInstagram:', error);
        throw error;
    }
} 