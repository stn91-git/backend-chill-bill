import * as admin from 'firebase-admin';
import serviceAccount from '../../firebase-admin.json';

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  storageBucket: "clone-pop.appspot.com"
});

// Export Firestore instance from admin SDK
export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage(); 