import React, { useState } from 'react';
import { 
  Laptop, GraduationCap, ArrowRight, Sparkles, Users, Key, 
  Tv, Zap, HelpCircle, Play, Shield, Brain, Timer, Award, Info
} from 'lucide-react';
import { MOROCCAN_AVATARS } from '../data';

interface WelcomeViewProps {
  onJoinStudent: (name: string, avatar: string, pin: string) => Promise<void>;
  onNavigateToTeacher: () => void;
  onNavigateToProjector: () => void;
  onNavigateToStudent: () => void;
  error?: string | null;
}

export default function WelcomeView({ 
  onJoinStudent, 
  onNavigateToTeacher, 
  onNavigateToProjector, 
  onNavigateToStudent, 
  error 
}: WelcomeViewProps) {
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

    loading || setLoading(true);
    try {
      await onJoinStudent(studentName.trim(), selectedAvatar, pinInput.trim());
    } catch (err: any) {
      setErrorLocal(err.message || 'تعذر الدخول، يرجى إعادة المحاولة.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 md:py-16 text-right font-sans" dir="rtl">
      {/* Hero Welcome banner */}
      <div className="text-center mb-12 space-y-4">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/10 via-[#1b43be]/10 to-emerald-500/10 border border-amber-500/30 px-4 py-2 rounded-full shadow-sm">
          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
          <span className="text-xs font-black text-[#1b43be]">بوابة الألعاب التربوية الحية والمحاكاة التفاعلية بالمملكة المغربية 🇲🇦</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[#1b43be] drop-shadow-xs">
          مَسـَابَقَات القِسْـم التَّفَـاعُلِيَّة <span className="text-[#c84b31]">«جَزِيرَة الـكَنـْز»</span> 🗺️🎮
        </h1>
        <p className="text-sm md:text-base text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed">
          بناء مهارات جيل الغد بأسلوب تربوي مشوق في مواد <span className="text-emerald-700 font-extrabold">التربية الإسلامية</span>، <span className="text-[#c84b31] font-extrabold">اللغة العربية</span>، <span className="text-[#1b43be] font-extrabold">الرياضيات</span>، و<span className="text-amber-700 font-extrabold">النشاط العلمي</span> بلغة مبهجة ومسابقات حية متزامنة!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        
        {/* Student panel column card */}
        <div id="student-card" className="bg-moroccan-zellij-light rounded-3xl p-6 md:p-8 shadow-xl border-t-8 border-t-[#1b43be] border-x border-b border-amber-500/30 flex flex-col justify-between space-y-6 transition-all hover:shadow-2xl relative">
          <div className="absolute top-4 left-4 bg-[#1b43be]/10 text-[#1b43be] border border-[#1b43be]/20 px-3 py-1 rounded-full text-[10px] font-black tracking-wider">
            رصيف أبطال السادس البواسل 🧭
          </div>
          
          <div className="space-y-3 pt-4">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3">
              <span className="bg-[#1b43be]/10 p-2 rounded-2xl text-[#1b43be]">🎒</span>
              <span>التحاق التلاميذ والفرق</span>
            </h2>
            <p className="text-xs text-slate-500 font-bold leading-relaxed">
              افتح سفينتكم الخاصة! أدخل رمز الغرفة <span className="text-[#1b43be] font-black">PIN</span> المشترك في القسم لتنطلق مع رفاقك لجمع الذهب!
            </p>
          </div>

          <form onSubmit={handleSubmitStudent} className="space-y-4">
            {/* Room Pin */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 block">رمز الغرفة (رابط معبر الحصن):</label>
              <input
                type="number"
                placeholder="أدخل الرمز المكون من 4 أرقام (مثال: 4125)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full text-center tracking-[0.2em] font-mono font-black text-lg p-3 bg-white border-2 border-[#1b43be]/30 focus:border-[#1b43be] focus:ring-4 focus:ring-[#1b43be]/10 rounded-2xl outline-none transition-all text-slate-900"
                disabled={loading}
              />
            </div>

            {/* Student Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 block">اسم البطل أو الثنائي المقاتل:</label>
              <input
                type="text"
                placeholder="مثال: يوسف وأحمد، مريم، مجموعة النصر..."
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full text-sm p-3.5 bg-white border border-slate-300 focus:border-[#1b43be] focus:ring-4 focus:ring-[#1b43be]/5 rounded-2xl outline-none transition-all font-bold"
                disabled={loading}
                maxLength={15}
              />
            </div>

            {/* Avatar chooser */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 block text-right">اختر تميمة أو شعار سفينتكم المظفرة:</label>
              <div className="grid grid-cols-5 gap-1.5 p-2 bg-white border border-slate-200 rounded-2xl">
                {MOROCCAN_AVATARS.map((av) => (
                  <button
                    key={av.name}
                    type="button"
                    onClick={() => setSelectedAvatar(av.char)}
                    className={`p-2 text-xl rounded-xl transition-all cursor-pointer ${
                      selectedAvatar === av.char 
                        ? 'bg-gradient-to-r from-[#1b43be] to-[#0d2a84] text-white scale-110 shadow-md ring-2 ring-amber-400' 
                        : 'hover:bg-slate-100 bg-slate-50 text-slate-800'
                    }`}
                    title={av.name}
                  >
                    {av.char}
                  </button>
                ))}
              </div>
            </div>

            {(errorLocal || error) && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-[11px] font-bold text-center leading-relaxed">
                {errorLocal || error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full p-4 rounded-2xl font-black text-sm text-white transition-all flex items-center justify-center gap-2 cursor-pointer ${
                loading
                  ? 'bg-slate-350 cursor-wait'
                  : 'btn-3d-indigo shadow-md shadow-[#1b43be]/20'
              }`}
            >
              <span>{loading ? 'جاري الاتصال...' : 'أبحـر إلـى التـحدي المـثير! ⛵'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Teacher portal panel column card */}
        <div id="teacher-card" className="bg-[#0c1424] bg-moroccan-zellij-dark text-slate-100 rounded-3xl p-6 md:p-8 shadow-xl border-t-8 border-t-[#c84b31] border-x border-b border-[#c84b31]/30 flex flex-col justify-between space-y-6 transition-all hover:shadow-2xl relative">
          <div className="absolute top-4 left-4 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full text-[10px] font-black tracking-wider">
            مخطوطة الأستاذ الفاضل 📜
          </div>

          <div className="space-y-4 pt-4">
            <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-3">
              <span className="bg-[#c84b31]/10 p-2 rounded-2xl text-[#c84b31]">🎓</span>
              <span>غرفة المدرس ومولد المناهج الذكي</span>
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed font-bold">
              لوحة متكاملة مستوحاة من عتاد المدارس المغربية التقليدية ومخطوطاتها الذهبية؛ تتيح للأستاذ إطلاق المسابقات فورا، تقسيم الحلفاء، تفجير أسئلة المنهاج الوطني وتحفيز حماس المتعلمين.
            </p>
          </div>

          <div className="space-y-4 p-4 bg-slate-900/80 border border-slate-850 rounded-2xl">
            <h3 className="text-xs font-black text-amber-400">ميزات التدريس الفعالة:</h3>
            <ul className="space-y-2 text-[11px] text-slate-400 font-bold list-disc list-inside">
              <li>مولد الأسئلة التلقائي لقرية الذكاء الاصطناعي (Gemini).</li>
              <li>التحكم بسير جولات الجزر الست وتوجيه البروجيكتور التلقائي.</li>
              <li>تقييم يدوي فوري للإجابات المتميزة مع رصد مجوهرات التعزيز.</li>
              <li>تنشيط بطاقات المعينات (مساعدة الفيلسوف، حماية شرف الأطلس).</li>
            </ul>
          </div>

          <button
            onClick={onNavigateToTeacher}
            className="w-full p-4 rounded-2xl btn-3d-emerald text-white font-black text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>الدخول إلى لوحة الأستاذ الميسر [رمز: 2026] 👨‍🏫</span>
            <Laptop className="w-4 h-4 text-emerald-200" />
          </button>
        </div>

      </div>

      {/* QUICK SIMULATION & TESTING WORKSPACE */}
      <section id="simulator-workspace" className="mt-12 bg-[#09152b] text-white rounded-3xl p-6 md:p-8 shadow-2xl border-2 border-amber-500/25 space-y-6 relative overflow-hidden">
        {/* Subtle decorative dome shape in absolute */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#1b43be]/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-10 w-64 h-64 bg-[#c84b31]/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-indigo-950 pb-4 relative z-10">
          <div className="space-y-1">
            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-550/30 px-3 py-1 rounded-full font-black uppercase">
              لوحة المحاكاة وبطاقة المسابقة التوضيحية 🧪⚙️
            </span>
            <h3 className="text-xl font-black text-white">كيف تجري جولات جزيرة الكنز المغربية التفاعلية؟</h3>
          </div>
          <p className="text-xs text-slate-300 max-w-sm leading-relaxed font-semibold">
            يمكنك محاكاة دورة اللعبة كاملة بمفردك! افتح الواجهات كلها في متصفحك سوياً لتشاهد معجزة التزامن الفوري ومساعدة الذكاء الاصطناعي الشامل.
          </p>
        </div>

        {/* 4 Step visual process */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
          {[
            { step: '١', title: 'تأسيس المعلم للحصة', desc: 'ادخل كمدرس (رمز 2026)، واختر مستوى السادس الابتدائي ثم انقر إطلاق الغرفة للحصول على الـ PIN اللاسلكي.' },
            { step: '٢', title: 'عرض خريطة جزيرة الكنز', desc: 'افتح شاشة البروجيكتور وضع رقم الـ PIN. ستظهر خارطة الأربطة والقلاع المغربية التراثية وحركة السفن للحلفاء.' },
            { step: '٣', title: 'دخول وتسمية أسطول المجموعات', desc: 'افتح واجهة التلميذ، اكتب الرمز وشارك مع جليسك باختيار تميمتك ليرتفع علم فريقك فوراً بالمرفأ اللاسلكي.' },
            { step: '٤', title: 'تفعيل قلاع العلم وقرية الـ AI', desc: 'انقر على أي عمارة بالخارطة ليفجّر خادم الـ Gemini سؤالاً حيوياً. يجاوب المتعلمون في هواتفهم لكسب الذهب!' }
          ].map((item, idx) => (
            <div key={idx} className="bg-[#0c1424]/80 border border-amber-500/20 p-5 rounded-2xl relative space-y-2 hover:border-amber-500/45 transition-colors">
              <span className="absolute top-3 left-3 w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black text-xs">
                {item.step}
              </span>
              <p className="font-black text-xs text-amber-300 pt-2">{item.title}</p>
              <p className="text-[11px] text-slate-400 leading-relaxed font-bold">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* 1-Click Fast Switch Buttons to satisfy "What is next" */}
        <div className="bg-[#050c18] p-5 rounded-2xl border border-indigo-950 space-y-4 relative z-10">
          <p className="text-xs font-black text-slate-350 text-center">👇 اختصار تشغيل الأدوار المختلفة بكبسة واحدة:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            {/* Run Teacher portal */}
            <button
              onClick={onNavigateToTeacher}
              className="p-3.5 btn-3d bg-[#0d9488] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-transform cursor-pointer border-b-4 border-[#115e59] shadow-md"
            >
              <Laptop className="w-4 h-4 animate-bounce" />
              <span>لوحة الأستاذ الميسر [رمز: 2026] 👨‍🏫</span>
            </button>

            {/* Run Projector Big Map screen */}
            <button
              onClick={onNavigateToProjector}
              className="p-3.5 btn-3d bg-[#d97706] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-transform cursor-pointer border-b-4 border-[#92400e] shadow-md"
            >
              <Tv className="w-4 h-4" />
              <span>شاشة العرض والصورة الكبرى 🎥🗺️</span>
            </button>

            {/* Run Student simulated screen */}
            <button
              onClick={onNavigateToStudent}
              className="p-3.5 btn-3d bg-[#1b43be] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-transform cursor-pointer border-b-4 border-[#0f2ba1] shadow-md"
            >
              <GraduationCap className="w-4 h-4" />
              <span>محاكاة هاتف التلميذ البطل 🎒📱</span>
            </button>

          </div>
        </div>

        {/* Bento description of Points, Stages, Helpers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          
          {/* Rules: Stages & Castles */}
          <div className="bg-[#0c1424]/60 border border-indigo-950 p-5 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 border-b border-[#1b43be]/20 pb-2">
              <Award className="w-4.5 h-4.5 text-amber-400" />
              <h4 className="text-xs font-black text-amber-300">قلاع المعرفة العلمية المبهجة 🎨🕌</h4>
            </div>
            <ul className="space-y-2 text-[11px] text-slate-300 leading-relaxed font-bold">
              <li>• <span className="text-emerald-400 font-black">🕌 محطة الهدى (الإسلامية):</span> مواقف دينية، أحكام الوضوء والطهارة والسنن.</li>
              <li>• <span className="text-[#c84b31] font-black">📖 حصن الضاد (اللغة العربية):</span> التراكيب النحوية المقررة، الصرف والتحويل.</li>
              <li>• <span className="text-indigo-400 font-black">📐 رباط الخوارزمي (الرياضيات):</span> هندسة المستطيل والقياس، حساب الميزانية بالدراهم.</li>
              <li>• <span className="text-amber-400 font-black">🔬 منارة ابن البيطار (العلوم):</span> توازن البيئة المغربية وأعضاء الإنسان الحيوية.</li>
            </ul>
          </div>

          {/* Rules: Points & Risks */}
          <div className="bg-[#0c1424]/60 border border-indigo-950 p-5 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 border-b border-[#1b43be]/20 pb-2">
              <Sparkles className="w-4.5 h-4.5 text-amber-400" />
              <h4 className="text-xs font-black text-amber-300">نظام الذهب ووضع المخاطرة 🪙🔥</h4>
            </div>
            <ul className="space-y-2 text-[11px] text-slate-350 leading-relaxed font-semibold">
              <li>• <span className="text-white font-extrabold">الجزاء الذهبي:</span> كل قلعة تقدم 1000 ذهبية للتحدي، ترتفع بنقاء وسرعة توقيت الاستجابة.</li>
              <li>• <span className="text-white font-extrabold">عقوبة الخطأ:</span> تخسر المجموعة -300 ذهبية في المحاولة الفاشلة (عقوبة التخمين العشوائي).</li>
              <li>• <span className="text-white font-extrabold">وضع المخاطرة (Double Risk):</span> يفعله المعلم ليضاعف نقاط كنز القلعة لـ 2x (+2000)، لكن الخطأ فيه يعني الخصم الأكيد.</li>
            </ul>
          </div>

          {/* Rules: Magic Powerups */}
          <div className="bg-slate-900/40 border border-indigo-900/30 p-5 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 border-b border-indigo-900 pb-2">
              <Sparkles className="w-5 h-5 text-teal-400" />
              <h4 className="text-xs font-black text-amber-200">بطاقات المعينات والمساعدات السحرية 🔮🛡️</h4>
            </div>
            <ul className="space-y-2 text-[11px] text-slate-350 leading-relaxed font-semibold">
              <li>• <span className="text-white font-extrabold">🔮 بطاقة الفيلسوف:</span> تسأل Gemini AI فيعطيك تلميحاً ذكياً عميقاً يقرّب المجموعة للجواب الصحيح.</li>
              <li>• <span className="text-white font-extrabold">🛡️ درع الأطلس الشامخ:</span> يحصن المجموعة ويحمي رصيدها من خسارة الذهب تماماً في هذه جولة إن أخطأت.</li>
              <li>• <span className="text-white font-extrabold">🌋 زلزال وقت القلعة:</span> يتسبب في هزة تهز شريط الوقت وتضيف 15 ثانية للكل للتواجد والتفكير!</li>
            </ul>
          </div>

        </div>
      </section>

      <div className="mt-12 text-center text-[10px] text-slate-400 font-bold border-t border-slate-900 pt-6">
        <span>تطبيق مسابقات القسم المغربية 🌟 متزامن لحظياً بلا انتظار</span>
      </div>
    </div>
  );
}
