const { db } = require('../src/lib/firebase');
const { collection, getDocs, query, where } = require('firebase/firestore');

async function checkDuplicates() {
  const productsCol = collection(db, 'products');
  const snap = await getDocs(productsCol);
  const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const counts = {};
  products.forEach(p => {
    const key = `${p.brand}_${p.itemName}`;
    if (!counts[key]) counts[key] = [];
    counts[key].push(p);
  });
  
  console.log('--- DUPLICATE ITEMS FOUND ---');
  for (const [key, list] of Object.entries(counts)) {
    if (list.length > 1) {
      console.log(`Key: ${key}`);
      list.forEach(p => console.log(`  ID: ${p.id}, Subject: ${p.accountingSubject}, Category: ${p.category}`));
    }
  }
}

checkDuplicates().catch(console.error);
