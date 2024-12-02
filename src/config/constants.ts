if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not defined in environment variables');
}

export const PORT = process.env.PORT || 3001;
export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
export const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY as string; 