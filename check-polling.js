import * as firestore from "firebase/firestore";
console.log(Object.keys(firestore).filter(k => k.toLowerCase().includes("polling")));
