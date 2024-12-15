import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { IgApiClient } from 'instagram-private-api';
import { readFile } from 'fs';
import { promisify } from 'util';
const readFileAsync = promisify(readFile);

dotenv.config();

const ig = new IgApiClient();

export async function postReelsToInstagram() {
    ig.state.generateDevice(process.env.INSTAGRAM_USERNAME_DIET_PEPSI!);
    await ig.simulate.preLoginFlow();
    const loggedInUser = await ig.account.login(process.env.INSTAGRAM_USERNAME_DIET_PEPSI!, process.env.INSTAGRAM_PASSWORD_DIET_PEPSI!);
    console.log(loggedInUser);

    // Get list of videos from uploads directory
    const uploadsDir = path.resolve(__dirname, '../../uploads');
    const files = await fs.readdir(uploadsDir);
    const videoFiles = files.filter(file => file.endsWith('.mp4'));

    if (videoFiles.length === 0) {
        throw new Error('No videos found in uploads directory');
    }

    // Pick the first video
    const videoPath = path.join(uploadsDir, videoFiles[0]);
    console.log('Posting video:', videoPath);
    const videoBuffer = await readFileAsync(videoPath);
    const coverPath = '/Users/gitarthakashyap/Documents/gen-ai/backend/src/bryan-dijkhuizen-Prg_UfDpfeQ-unsplash.jpg';
    const coverBuffer = await readFileAsync(coverPath);
    await ig.publish.video({
        video: videoBuffer,
        coverImage: coverBuffer,
        caption: 'Diet Pepsi'
    }).then((res) => {
        console.log(res);
    }).catch((err) => {
        console.log(err);
    });
} 