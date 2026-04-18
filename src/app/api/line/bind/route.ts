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
    const { student_id, teacher_id, line_uid, input_mobile, relationship } = body;

    if (!line_uid || !input_mobile || (!student_id && !teacher_id)) {
      return NextResponse.json({ error: '缺少必要參數 (ID/UID/Mobile)' }, { status: 400 });
    }

    const cleanMobile = normalizeMobile(input_mobile);

    let matchedName = '';
    
    // 1 & 2. 驗證身分
    if (student_id) {
      const studentRef = doc(db, 'students', student_id);
      const studentSnap = await getDoc(studentRef);
      if (!studentSnap.exists()) return NextResponse.json({ error: '找不到該學生資料' }, { status: 404 });
      
      const studentData = studentSnap.data();
      const contactMobiles = studentData.contact_mobiles || [];
      const isMatched = contactMobiles.some((m: string) => normalizeMobile(m) === cleanMobile);
      
      if (!isMatched) return NextResponse.json({ error: '手機號碼不符，請聯繫櫃檯老師更新聯絡資訊' }, { status: 400 });
      matchedName = studentData.name;
    } else if (teacher_id) {
      const teacherRef = doc(db, 'teachers', teacher_id);
      const teacherSnap = await getDoc(teacherRef);
      if (!teacherSnap.exists()) return NextResponse.json({ error: '找不到該老師資料' }, { status: 404 });
      
      const teacherData = teacherSnap.data();
      // 假設老師電話存放在 phone 欄位
      const teacherMobile = teacherData.phone || '';
      if (normalizeMobile(teacherMobile) !== cleanMobile) {
         return NextResponse.json({ error: '手機號碼與登記資料不符' }, { status: 400 });
      }
      matchedName = teacherData.name;
    }

    // 3. 檢查是否已經綁定過 (防止重複寫入)
    const bindingsRef = collection(db, 'line_bindings');
    const idField = student_id ? 'student_id' : 'teacher_id';
    const idVal = student_id || teacher_id;
    
    const q = query(bindingsRef, where('line_uid', '==', line_uid), where(idField, '==', idVal));
    const bindingSnap = await getDocs(q);

    if (bindingSnap.empty) {
      // 4. 寫入新的綁定資料
      const payload: any = {
        line_uid,
        matched_mobile: cleanMobile,
        role: student_id ? 'STUDENT' : 'TEACHER',
        created_at: Timestamp.now()
      };
      if (student_id) {
        payload.student_id = student_id;
        payload.studentName = matchedName;
        payload.relationship = relationship || '家長';
      } else {
        payload.teacherId = teacher_id;
        payload.teacherName = matchedName;
        payload.role = '老師'; // 覆寫角色標籤為顯示用
      }
      await addDoc(bindingsRef, payload);
      
      // 同步寫入 User 實體 (如果 User 實體具備 lineId 欄位)
      const userCol = student_id ? 'students' : 'teachers';
      await updateDoc(doc(db, userCol, idVal!), { lineId: line_uid });
      
      // 同步寫入驗證權限層 (userProfiles) 以便 UI 即時更新狀態
      if (teacher_id) {
        // 老師通常有登入帳號，對應到 userProfiles 管理
        const qUser = query(collection(db, 'userProfiles'), where('teacherId', '==', teacher_id));
        const snapUser = await getDocs(qUser);
        if (!snapUser.empty) {
          await updateDoc(doc(db, 'userProfiles', snapUser.docs[0].id), { lineId: line_uid });
        }
      }
    }

    // 5. 發送歡迎訊息 (Flex Message)
    const welcomeFlex = createWelcomeFlex([matchedName]);
    await sendLineMessage(line_uid, welcomeFlex);

    return NextResponse.json({ success: true, name: matchedName });

  } catch (error: any) {
    console.error('[LineBind API Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
