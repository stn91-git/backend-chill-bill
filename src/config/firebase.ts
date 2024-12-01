import * as admin from 'firebase-admin';
import serviceAccount from '../../firebase-admin.json';

// Initialize Firebase Admin with service account JSON file
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  storageBucket: "clone-pop.appspot.com"
});

// Export Firestore instance
export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage(); 