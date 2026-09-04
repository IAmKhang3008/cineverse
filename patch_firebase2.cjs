const fs = require('fs');
const path = './src/lib/firebase.ts';
let code = fs.readFileSync(path, 'utf8');

const target = `export const db = initializeFirestore(
  app,
  { 
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    experimentalAutoDetectLongPolling: true
  },
  firebaseConfigJson.firestoreDatabaseId
);`;

const replacement = `import { getFirestore } from "firebase/firestore";
export const db = getFirestore(app, firebaseConfigJson.firestoreDatabaseId);`;

code = code.replace(target, replacement);

fs.writeFileSync(path, code);
