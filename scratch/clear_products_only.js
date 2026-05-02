const { db } = require('../src/lib/firebase');
const { collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

async function clearProductsOnly() {
  const productsCol = collection(db, 'products');
  console.log('Fetching products...');
  const snap = await getDocs(productsCol);
  
  console.log(`Found ${snap.size} products. Deleting...`);
  
  const promises = snap.docs.map(d => deleteDoc(doc(db, 'products', d.id)));
  await Promise.all(promises);
  
  console.log('SUCCESS: All product definitions cleared. Transaction history was preserved.');
}

clearProductsOnly().catch(console.error);
