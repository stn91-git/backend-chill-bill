import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { IgApiClient } from 'instagram-private-api';
import { readFile, existsSync } from 'fs';
import { promisify } from 'util';
import ffmpeg from 'fluent-ffmpeg';
import { exec } from 'child_process';

const execAsync = promisify(exec);

// Check if ffmpeg is available in the system
async function checkFFmpeg() {
    try {
        await execAsync('which ffmpeg');
        return true;
    } catch (error) {
        return false;
    }
}

// Initialize FFmpeg
async function initializeFFmpeg() {
    const isReplit = process.env.REPL_ID !== undefined;

    if (isReplit) {
        const hasFFmpeg = await checkFFmpeg();
        if (!hasFFmpeg) {
            console.error('FFmpeg not found in system');
            throw new Error('FFmpeg not installed');
        }
        ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
    } else {
        const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
        ffmpeg.setFfmpegPath(ffmpegInstaller.path);
    }
}

// Initialize FFmpeg when module loads
initializeFFmpeg().catch(console.error);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// const execAsync = promisify(exec);
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

async function generateCoverImage(videoPath: string, coverPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .screenshots({
                timestamps: [1],
                filename: path.basename(coverPath),
                folder: path.dirname(coverPath),
                size: '1080x1920'
            })
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
    });
}

export async function postReelsToInstagram() {
    try {
        if (!process.env.INSTAGRAM_USERNAME_DIET_PEPSI || !process.env.INSTAGRAM_PASSWORD_DIET_PEPSI) {
            throw new Error('Instagram credentials not found in environment variables');
        }

        const loggedInUser = await login();
        console.log('Logged in as:', loggedInUser.username);

        const uploadsDir = path.resolve(__dirname, '../../uploads');
        const files = await fs.readdir(uploadsDir);
        const videoFiles = files.filter(file => file.endsWith('.mp4'));

        if (videoFiles.length === 0) {
            throw new Error('No videos found in uploads directory');
        }

        const videoPath = path.join(uploadsDir, videoFiles[0]);
        const coverPath = videoPath.replace('.mp4', '-cover.jpg');

        try {
            // Generate cover image
            await generateCoverImage(videoPath, coverPath);
            console.log('Generated cover image:', coverPath);

            const publishResult = await ig.publish.video({
                video: await readFileAsync(videoPath),
                coverImage: await readFileAsync(coverPath),
                caption: "Introducing something close to my heart: a project that’s been in the works and is finally coming to life. 🌟 The name says it all—'btxch 16.' It’s more than just a phrase; it’s a vision, a journey, and a representation of creativity and ambition. 🚀Every detail has been thoughtfully designed to capture the essence of innovation, style, and edge. Whether it’s the futuristic vibe of the design or the meaning behind the name, it’s all about making a bold statement. This isn’t just a logo; it’s a movement, a mark of something bigger that’s about to unfold.I believe that every great idea deserves to be celebrated, and this is my way of sharing a piece of that vision with all of you. Your support means the world, and I can’t wait to see where this journey takes us. 💡Here’s to stepping into the future, embracing creativity, and building something truly unique. Drop your thoughts in the comments below—I’d love to hear what you think about 'btxch 16'! Let’s make it bigger and better together. 💯 #btxch16 #NewChapter #Innovation #CreativeVibes #StayTuned"
            });

            console.log('Upload result:', publishResult);
            
            // Clean up files
            await fs.unlink(videoPath);
            await fs.unlink(coverPath);
            
            return publishResult;
        } catch (error) {
            if (existsSync(coverPath)) {
                await fs.unlink(coverPath).catch(console.error);
            }
            throw error;
        }
    } catch (error) {
        console.error('Error in postReelsToInstagram:', error);
        throw error;
    }
} 