// صفحة تشخيص — احذفها بعد حل المشكلة
export default async function handler(req: any, res: any) {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
  const firebaseApiKey = process.env.VITE_FIREBASE_API_KEY || '';
  const firebaseDbUrl = process.env.VITE_FIREBASE_DATABASE_URL || '';

  // اختبار Gemini API
  let geminiStatus = 'لم يتم الاختبار';
  if (geminiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'قل "مرحبا" فقط' }] }] }),
        }
      );
      geminiStatus = r.ok ? `✅ يعمل (${r.status})` : `❌ خطأ (${r.status}): ${(await r.text()).slice(0, 100)}`;
    } catch (e: any) {
      geminiStatus = `❌ استثناء: ${e.message}`;
    }
  } else {
    geminiStatus = '❌ المفتاح غير موجود في env vars';
  }

  res.status(200).json({
    timestamp: new Date().toISOString(),
    env: {
      GEMINI_API_KEY: geminiKey ? `✅ موجود (${geminiKey.length} حرف)` : '❌ مفقود',
      VITE_FIREBASE_API_KEY: firebaseApiKey ? `✅ موجود` : '❌ مفقود',
      VITE_FIREBASE_DATABASE_URL: firebaseDbUrl ? `✅ ${firebaseDbUrl}` : '❌ مفقود',
    },
    tests: {
      geminiAPI: geminiStatus,
    },
    instructions: 'احذف هذا الملف (api/debug.ts) بعد حل المشكلة.',
  });
}
