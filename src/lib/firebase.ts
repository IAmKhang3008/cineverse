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
  apiKey:            firebaseConfigJson.apiKey,
  authDomain:        firebaseConfigJson.authDomain,
  projectId:         firebaseConfigJson.projectId,
  storageBucket:     firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId:             firebaseConfigJson.appId,
};

// Khởi tạo Firebase app
const app = initializeApp(firebaseConfig);

// Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore với persistent cache (hoạt động offline, multi-tab)
import { getFirestore } from "firebase/firestore";
export const db = getFirestore(app, firebaseConfigJson.firestoreDatabaseId);

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