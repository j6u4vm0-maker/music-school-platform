const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, doc, runTransaction, setDoc, query, where, getDocs } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const XLSX = require('xlsx');
const path = require('path');

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
const auth = getAuth(app);

async function runImport() {
    console.log('Logging in as admin...');
    await signInWithEmailAndPassword(auth, 'admin@7th.com', 'admin777');
    console.log('Login successful.');

    const filePath = path.join(__dirname, '..', '庫存清單_2026-05-02-1.xlsx');
    const workbook = XLSX.readFile(filePath);
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    
    console.log(`Total rows to process: ${data.length}`);
    
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
            const getVal = (keywords) => {
                const key = Object.keys(row).find(k => 
                    keywords.some(kw => k.replace(/\s/g, '').includes(kw.replace(/\s/g, '')))
                );
                return key ? row[key] : undefined;
            };

            const brand = getVal(['樂器品牌/出版社', '商品名稱/出版社', '品牌', '出版社']) || '';
            const itemName = getVal(['型號', '品項', '品項名稱', '商品名稱']) || '';
            
            if (!brand && !itemName) {
                console.warn(`Row ${i+1}: Skipped (empty brand and itemName)`);
                continue;
            }

            const category = getVal(['分類']) || '樂器';
            const accountingSubject = getVal(['會計科目']);
            
            let finalSubject = accountingSubject;
            if (!finalSubject) {
                const brandStr = String(brand || '');
                if (brandStr.includes('歐德琴')) {
                    finalSubject = '樂器買賣';
                } else if (brandStr.includes('伯斯特') || brandStr.includes('音樂家小舖')) {
                    finalSubject = '樂譜買賣';
                } else {
                    finalSubject = '其他買賣';
                }
            }

            const costPrice = Number(getVal(['進價', '成本'])) || 0;
            const sellPrice = Number(getVal(['售價', '價格'])) || 0;
            const stockQty = Number(getVal(['庫存數量', '現有庫存', '數量'])) || 0;
            const minStock = Number(getVal(['最低安全', '安全庫存'])) || 5;

            // Step 1: Add Product
            const productsCol = collection(db, 'products');
            const productDoc = {
                category: String(category),
                brand: String(brand || '未分類'),
                itemName: String(itemName || '未命名商品'),
                origin: String(getVal(['產地']) || ''),
                material: String(getVal(['材質/特色', '材質']) || ''),
                accountingSubject: String(finalSubject || '其他買賣'),
                costPrice,
                sellPrice,
                profit: sellPrice - costPrice,
                stockQty: 0, 
                minStock,
                note: String(getVal(['備註']) || ''),
                createdAt: Date.now()
            };

            const docRef = await addDoc(productsCol, productDoc);
            const productId = docRef.id;

            // Step 2: Handle Initial Stock via Transaction
            if (stockQty > 0) {
                await runTransaction(db, async (transaction) => {
                    const productRef = doc(db, 'products', productId);
                    const inventoryCol = collection(db, 'inventory_transactions');
                    const ledgerCol = collection(db, 'financial_ledgers');
                    const mainTxCol = collection(db, 'transactions');

                    transaction.update(productRef, { stockQty: stockQty });

                    const now = Date.now();
                    const invTxRef = doc(inventoryCol);
                    transaction.set(invTxRef, {
                        productId,
                        type: 'IN_STOCK',
                        qtyChange: stockQty,
                        operator: '系統匯入',
                        timestamp: now
                    });

                    const ledgerRef = doc(ledgerCol);
                    transaction.set(ledgerRef, {
                        transactionId: invTxRef.id,
                        type: 'EXPENSE',
                        category: String(finalSubject || '其他買賣'),
                        amount: costPrice * stockQty,
                        timestamp: now
                    });

                    const mainTxRef = doc(mainTxCol);
                    transaction.set(mainTxRef, {
                        userId: 'SYSTEM',
                        userName: '零售/進貨系統',
                        type: 'EXPENSE',
                        category: String(finalSubject || '其他買賣'),
                        amount: -(costPrice * stockQty),
                        description: `[庫存系統] 進貨: ${productDoc.itemName} x ${stockQty}`,
                        date: new Date(now).toISOString().split('T')[0],
                        createdAt: now,
                        paymentMethod: 'CASH',
                        refId: invTxRef.id
                    });
                });
            }
            
            successCount++;
            if (successCount % 10 === 0) console.log(`Progress: ${successCount} imported...`);
        } catch (err) {
            console.error(`Row ${i+1} Error:`, err.message);
            errorCount++;
        }
    }

    console.log(`\nImport Finished!`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${errorCount}`);
    process.exit(0);
}

runImport().catch(err => {
    console.error('Critical Error:', err);
    process.exit(1);
});
