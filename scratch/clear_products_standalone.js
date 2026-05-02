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

async function run() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  
  const productsCol = collection(db, 'products');
  console.log('Fetching all products...');
  const snap = await getDocs(productsCol);
  
  console.log(`Found ${snap.size} products. Starting deletion...`);
  
  let deleted = 0;
  for (const d of snap.docs) {
    await deleteDoc(doc(db, 'products', d.id));
    deleted++;
    if (deleted % 50 === 0) console.log(`Deleted ${deleted}...`);
  }
  
  console.log('SUCCESS: All product definitions have been cleared. Transactions and Ledgers were NOT touched.');
}

run().catch(console.error);
