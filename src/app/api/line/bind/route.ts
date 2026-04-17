import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, addDoc, Timestamp } from 'firebase/firestore';
import { getLineConfig, createWelcomeFlex, sendLineMessage } from '@/lib/services/line';

/** 正規化手機號碼：移除非數字字元並處理 886 */
function normalizeMobile(mobile: string): string {
  let cleaned = mobile.replace(/\D/g, '');
  if (cleaned.startsWith('886')) {
    cleaned = '0' + cleaned.substring(3);
  }
  return cleaned;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { student_id, line_uid, input_mobile, relationship } = body;

    if (!student_id || !line_uid || !input_mobile) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    const cleanMobile = normalizeMobile(input_mobile);

    // 1. 讀取學生資料
    const studentRef = doc(db, 'students', student_id);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) {
      return NextResponse.json({ error: '找不到該學生資料' }, { status: 404 });
    }

    const studentData = studentSnap.data();
    const contactMobiles = studentData.contact_mobiles || [];

    // 2. 比對手機號碼是否在允許清單中
    // 這裡我們將清單中的號碼也進行正規化後排比
    const isMatched = contactMobiles.some((m: string) => normalizeMobile(m) === cleanMobile);

    if (!isMatched) {
      console.warn(`[LineBind] Mobile mismatch: input=${cleanMobile}, expected one of [${contactMobiles.map(normalizeMobile).join(',')}]`);
      return NextResponse.json({ error: '手機號碼不符，請聯繫櫃檯老師更新聯絡資訊' }, { status: 400 });
    }

    // 3. 檢查是否已經綁定過 (防止重複寫入)
    const bindingsRef = collection(db, 'line_bindings');
    const q = query(bindingsRef, where('line_uid', '==', line_uid), where('student_id', '==', student_id));
    const bindingSnap = await getDocs(q);

    if (bindingSnap.empty) {
      // 4. 寫入綁定資料
      await addDoc(bindingsRef, {
        student_id,
        line_uid,
        matched_mobile: cleanMobile,
        relationship: relationship || '家長',
        created_at: Timestamp.now()
      });
    }

    // 5. 發送歡迎訊息 (Flex Message)
    const welcomeFlex = createWelcomeFlex([studentData.name]);
    await sendLineMessage(line_uid, welcomeFlex);

    return NextResponse.json({ success: true, student_name: studentData.name });

  } catch (error: any) {
    console.error('[LineBind API Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
