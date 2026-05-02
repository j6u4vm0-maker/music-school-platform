const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyA-Wb8TrrajxIFh4NOE23hr3qyY0nxSckE",
  authDomain: "musicschoolsystem-e3557.firebaseapp.com",
  projectId: "musicschoolsystem-e3557",
  storageBucket: "musicschoolsystem-e3557.firebasestorage.app",
  messagingSenderId: "766592247498",
  appId: "1:766592247498:web:e8cc2def908de850aaf633",
};

async function verify() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const productsCol = collection(db, 'products');
  
  const snap = await getDocs(productsCol);
  console.log(`CURRENT PRODUCT COUNT: ${snap.size}`);
  
  if (snap.size > 0) {
    console.log('Sample IDs:', snap.docs.slice(0, 5).map(d => d.id));
  }
}

verify().catch(console.error);
