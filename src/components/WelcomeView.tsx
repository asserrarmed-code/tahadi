import React, { useState } from 'react';
import { Laptop, GraduationCap, ArrowRight, Sparkles, Users, Key } from 'lucide-react';
import { MOROCCAN_AVATARS } from '../data';

interface WelcomeViewProps {
  onJoinStudent: (name: string, avatar: string, pin: string) => Promise<void>;
  onNavigateToTeacher: () => void;
  error?: string | null;
}

export default function WelcomeView({ onJoinStudent, onNavigateToTeacher, error }: WelcomeViewProps) {
  const [pinInput, setPinInput] = useState('');
  const [studentName, setStudentName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🦁');
  const [loading, setLoading] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const handleSubmitStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal(null);
    if (!pinInput.trim()) {
      setErrorLocal('المرجو إدخال رمز الغرفة PIN للالتحاق بالحصة! 🎒');
      return;
    }
    if (!studentName.trim()) {
      setErrorLocal('من فضلك اكتب اسمك أو اسم فريقك الثنائي! ✏️');
      return;
    }

    setLoading(true);
    try {
      await onJoinStudent(studentName.trim(), selectedAvatar, pinInput.trim());
    } catch (err: any) {
      setErrorLocal(err.message || 'تعذر الدخول، المرجو التحقق من رمز الغرفة.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 md:py-16 text-right" dir="rtl">
      {/* Hero Welcome banner */}
      <div className="text-center mb-12 space-y-4">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/10 to-indigo-500/10 border border-indigo-100/50 px-4 py-2 rounded-full shadow-sm">
          <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
          <span className="text-xs font-black text-indigo-950">تطبيق كاهوت الصفوف المغربية التفاعلي المطور 🇲🇦</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-905">
          مَسَابَقَات القِسْم التَّفَاعُلِية الرَّقْمِيَّة 🎮
        </h1>
        <p className="text-sm md:text-base text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">
          بوابة الألعاب الحية المتزامنة من أجل إغناء مكتسبات المتعلمين في الرياضيات، التربية الإسلامية، العلوم، واللغة العربية بأسلوب شيق وحيوي.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        
        {/* Student panel column card */}
        <div id="student-card" className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-indigo-50 flex flex-col justify-between space-y-6 transition-all hover:shadow-2xl hover:border-indigo-100 relative">
          <div className="absolute top-4 left-4 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black tracking-wider">
            مساحة التحدي ⚡
          </div>
          
          <div className="space-y-3">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3">
              <span className="bg-indigo-100 p-2 rounded-2xl text-indigo-700">🎒</span>
              <span>دخول الأبطال والمتعلمين</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              أدخل رمز الغرفة PIN الذي يشاركه معك الأستاذ وانضم فوراً للمنافسة!
            </p>
          </div>

          <form onSubmit={handleSubmitStudent} className="space-y-4">
            {/* Room Pin */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">رمز الغرفة (PIN المعركة):</label>
              <input
                type="number"
                placeholder="أدخل الرمز المكون من 4 أرقام (مثال: 4125)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full text-center tracking-[0.2em] font-mono font-black text-lg p-3 bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all"
                disabled={loading}
              />
            </div>

            {/* Student Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">اسم التلميذ أو الفريق:</label>
              <input
                type="text"
                placeholder="مثال: يوسف، أمينة، فريق النصر..."
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full text-sm p-3.5 bg-slate-50 border border-slate-250 focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                disabled={loading}
                maxLength={15}
              />
            </div>

            {/* Avatar chooser */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">اختر وسمك أو جليسك المفضل:</label>
              <div className="grid grid-cols-5 gap-1.5 p-2.5 bg-slate-50 border border-slate-100 rounded-2xl">
                {MOROCCAN_AVATARS.map((av) => (
                  <button
                    key={av.name}
                    type="button"
                    onClick={() => setSelectedAvatar(av.char)}
                    className={`p-2 text-xl rounded-xl transition-all cursor-pointer ${
                      selectedAvatar === av.char 
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white scale-110 shadow-md ring-2 ring-indigo-200' 
                        : 'hover:bg-slate-200/60 bg-white text-slate-700'
                    }`}
                    title={av.name}
                  >
                    {av.char}
                  </button>
                ))}
              </div>
            </div>

            {(errorLocal || error) && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-[11px] font-bold text-center leading-relaxed">
                {errorLocal || error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full p-4 rounded-2xl font-black text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                loading
                  ? 'bg-slate-350 cursor-wait'
                  : 'bg-gradient-to-r from-indigo-700 to-indigo-600 hover:from-indigo-600 hover:shadow-indigo-100'
              }`}
            >
              <span>{loading ? 'جاري الاتصال بقاعدة البيانات...' : 'انطلق إلى الحصة الحية 🚀'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Teacher portal panel column card */}
        <div id="teacher-card" className="bg-slate-900 text-slate-100 rounded-3xl p-6 md:p-8 shadow-xl border border-slate-850 flex flex-col justify-between space-y-6 transition-all hover:shadow-2xl relative">
          <div className="absolute top-4 left-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-black tracking-wider">
            منصة الإشراف 💻
          </div>

          <div className="space-y-4">
            <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-3">
              <span className="bg-slate-800 p-2 rounded-2xl text-emerald-400">🎓</span>
              <span>واجهة الأستاذ والمدير</span>
            </h2>
            <p className="text-xs text-slate-450 leading-relaxed font-semibold">
              لوحة متكاملة مخصصة للمعلم لإدارة الصف، إحضار وتقسيم المجموعات، تشغيل الامتحانات الصامتة، وتوليد أسئلة المغرب البيداغوجية المتكيفة بلمسة ذكاء اصطناعي.
            </p>
          </div>

          <div className="space-y-4 p-4 bg-slate-850/60 border border-slate-800/80 rounded-2xl">
            <h3 className="text-xs font-black text-emerald-400">مميزات لوحة الأستاذ الآمنة:</h3>
            <ul className="space-y-2 text-[11px] text-slate-400 font-semibold list-disc list-inside">
              <li>توليد مستندات الأسئلة بالذكاء الاصطناعي (Gemini).</li>
              <li>التحكم عن بعد بكل الغرف، وتمرير الأسئلة لحظياً بنقرة زر.</li>
              <li>تقييم يدوياً للأسئلة الشفهية مع رصد فوري للعلامات.</li>
              <li>تفعيل استعانات التلاميذ (حذف خيارين، زيادة مؤقت).</li>
            </ul>
          </div>

          <button
            onClick={onNavigateToTeacher}
            className="w-full p-4 rounded-2xl bg-emerald-550 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition-all shadow-md hover:shadow-emerald-950/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>الدخول إلى لوحة الأستاذ المشرف</span>
            <Laptop className="w-4 h-4 text-emerald-200" />
          </button>
        </div>

      </div>

      <div className="mt-12 text-center text-[10px] text-slate-400 font-bold">
        <span>تطبيق مسابقات القسم المغربية 🌟 متزامن لحظياً بلا انتظار</span>
      </div>
    </div>
  );
}
