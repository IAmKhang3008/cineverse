/// <reference types="vite/client" />
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
} from "firebase/firestore";
import firebaseConfigJson from "../../firebase-applet-config.json";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || firebaseConfigJson.apiKey,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || firebaseConfigJson.authDomain,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || firebaseConfigJson.projectId,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || firebaseConfigJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || firebaseConfigJson.appId,
};

// Khởi tạo Firebase app
const app = initializeApp(firebaseConfig);

// Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore với persistent cache (hoạt động offline, multi-tab)
export const db = initializeFirestore(
  app,
  { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
  firebaseConfigJson.firestoreDatabaseId
);

// Validate Connection to Firestore (Skill Requirement & Offline Resilience)
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && (error.message.includes('offline') || error.message.includes('unavailable'))) {
      console.warn("[Firebase] Operating in offline cache mode or initial connection pending:", error.message);
    }
  }
}
testConnection();

// ============================================================
// ERROR HANDLER
// ============================================================
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST   = 'list',
  GET    = 'get',
  WRITE  = 'write',
}

export interface FirestoreErrorInfo {
  error:         string;
  operationType: OperationType;
  path:          string | null;
  authInfo: {
    userId?:        string | null;
    email?:         string | null;
    emailVerified?: boolean | null;
    isAnonymous?:   boolean | null;
  };
}

export function handleFirestoreError(
  error:         unknown,
  operationType: OperationType,
  path:          string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId:        auth.currentUser?.uid,
      email:         auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous:   auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('[Firebase Firestore Error]:', JSON.stringify(errInfo));
  throw error;
}