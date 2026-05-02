const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyA-Wb8TrrajxIFh4NOE23hr3qyY0nxSckE",
  authDomain: "musicschoolsystem-e3557.firebaseapp.com",
  projectId: "musicschoolsystem-e3557",
  storageBucket: "musicschoolsystem-e3557.firebasestorage.app",
  messagingSenderId: "766592247498",
  appId: "1:766592247498:web:e8cc2def908de850aaf633",
  measurementId: "G-FEFE64V41H"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const collectionsToClear = [
  'products',
  'inventory_transactions',
  'financial_ledgers'
];

async function clearCollections() {
  for (const colName of collectionsToClear) {
    console.log(`Clearing collection: ${colName}...`);
    const colRef = collection(db, colName);
    const snapshot = await getDocs(colRef);
    
    const deletePromises = snapshot.docs.map(document => {
      console.log(`Deleting doc ${document.id} from ${colName}`);
      return deleteDoc(doc(db, colName, document.id));
    });
    
    await Promise.all(deletePromises);
    console.log(`Finished clearing ${colName}. Total deleted: ${snapshot.size}`);
  }
}

clearCollections().then(() => {
  console.log('All inventory data cleared successfully.');
  process.exit(0);
}).catch(err => {
  console.error('Error clearing data:', err);
  process.exit(1);
});
