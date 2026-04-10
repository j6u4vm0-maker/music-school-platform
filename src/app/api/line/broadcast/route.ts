import { NextRequest, NextResponse } from 'next/server';
import { getStudentBindings, createBroadcastFlex, sendLineMulticastMessage } from '@/lib/services/line';

/**
 * 精準圖文集體推播 API
 * POST /api/line/broadcast
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      target_student_ids, 
      broadcast_title, 
      broadcast_desc, 
      image_url, 
      action_url 
    } = body;

    // 1. 參數驗證
    if (!target_student_ids || !Array.isArray(target_student_ids) || target_student_ids.length === 0) {
      return NextResponse.json({ error: '必須提供 target_student_ids 陣列' }, { status: 400 });
    }
    if (!broadcast_title || !broadcast_desc || !action_url) {
      return NextResponse.json({ error: '標題、描述與動作連結為必填' }, { status: 400 });
    }

    console.log(`[Broadcast] Preparing message for ${target_student_ids.length} potential students.`);

    // 2. 抓取對應的 line_uid (處理多對多關係)
    const lineUidSet = new Set<string>();
    
    for (const studentId of target_student_ids) {
      const bindings = await getStudentBindings(studentId);
      bindings.forEach(b => {
        if (b.lineUid) lineUidSet.add(b.lineUid);
      });
    }

    const lineUids = Array.from(lineUidSet);
    if (lineUids.length === 0) {
      return NextResponse.json({ 
        status: 'warning', 
        message: '找不到任何已綁定的 LINE 帳號，發送中斷。',
        recipients_count: 0
      });
    }

    // 3. 建立 Flex Message
    const flexMessage = createBroadcastFlex(
      broadcast_title,
      broadcast_desc,
      image_url,
      action_url
    );

    // 4. 多人推播 (Multicast)
    const result = await sendLineMulticastMessage(lineUids, flexMessage);

    return NextResponse.json({
        status: 'success',
        target_students_count: target_student_ids.length,
        actual_line_uids_count: lineUids.length,
        result
    });

  } catch (error: any) {
    console.error('[API/Broadcast] Error:', error);
    return NextResponse.json({ 
      status: 'error', 
      message: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}
