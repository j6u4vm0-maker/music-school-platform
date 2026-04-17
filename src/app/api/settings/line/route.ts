import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { clearLineCache } from '@/lib/services/line';

const SETTINGS_DOC_ID = 'line';
const SETTINGS_COLLECTION = 'system_settings';

/** 遮蔽字串邏輯: ab12***89cd */
function maskSecret(secret: string | undefined): string {
  if (!secret) return '';
  if (secret.length <= 8) return '****';
  return `${secret.substring(0, 4)}****${secret.substring(secret.length - 4)}`;
}

// GET /api/settings/line
export async function GET() {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    const snap = await getDoc(docRef);
    
    if (!snap.exists()) {
      return NextResponse.json({
        line_channel_secret: '',
        line_channel_access_token: '',
        liff_id: '',
      });
    }

    const data = snap.data();
    return NextResponse.json({
      line_channel_secret: maskSecret(data.line_channel_secret),
      line_channel_access_token: maskSecret(data.line_channel_access_token),
      liff_id: data.liff_id || '',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/settings/line
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { line_channel_secret, line_channel_access_token, liff_id } = body;

    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    
    // 讀取舊資料，若新傳入的是遮蔽字元 (含有 ***)，則不更新該欄位
    const snap = await getDoc(docRef);
    const oldData = snap.exists() ? snap.data() : {};

    const newData = {
      line_channel_secret: line_channel_secret?.includes('***') ? oldData.line_channel_secret : line_channel_secret,
      line_channel_access_token: line_channel_access_token?.includes('***') ? oldData.line_channel_access_token : line_channel_access_token,
      liff_id: liff_id || '',
      updatedAt: Date.now(),
    };

    await setDoc(docRef, newData, { merge: true });
    
    // 清除伺服器端快取，確保下次發訊使用最新設定
    clearLineCache();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
