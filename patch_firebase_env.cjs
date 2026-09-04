const fs = require('fs');
const path = './src/lib/firebase.ts';
let code = fs.readFileSync(path, 'utf8');

// The environment variables might be empty strings, which evaluate to falsy in `||` but wait, `"" || config` works.
// Let's just remove import.meta.env to be completely sure it's using firebaseConfigJson!
code = code.replace(/import\.meta\.env\.VITE_FIREBASE_API_KEY\s*\|\|\s*/g, '');
code = code.replace(/import\.meta\.env\.VITE_FIREBASE_AUTH_DOMAIN\s*\|\|\s*/g, '');
code = code.replace(/import\.meta\.env\.VITE_FIREBASE_PROJECT_ID\s*\|\|\s*/g, '');
code = code.replace(/import\.meta\.env\.VITE_FIREBASE_STORAGE_BUCKET\s*\|\|\s*/g, '');
code = code.replace(/import\.meta\.env\.VITE_FIREBASE_MESSAGING_SENDER_ID\s*\|\|\s*/g, '');
code = code.replace(/import\.meta\.env\.VITE_FIREBASE_APP_ID\s*\|\|\s*/g, '');

fs.writeFileSync(path, code);
