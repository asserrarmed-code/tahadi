import React, { useState } from 'react';
import { Sparkles, Brain, Loader, Check, AlertCircle } from 'lucide-react';
import { QuizSet } from '../types';

interface AIGeneratorProps {
  onQuizAdded: (newQuiz: QuizSet) => void;
}

export default function AIGenerator({ onQuizAdded }: AIGeneratorProps) {
  const [level, setLevel] = useState('المستوى السادس');
  const [subject, setSubject] = useState('التربية الإسلامية');
  const [topic, setTopic] = useState('فرائض الوضوء سننه ونواقضه');
  const [instructions, setInstructions] = useState('أسئلة حماسية غنية بالمصطلحات البيداغوجية، مع إدراج شخصيات مغربية طريفة.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const levels = [
    'المستوى الأول',
    'المستوى الثاني',
    'المستوى الثالث',
    'المستوى الرابع',
    'المستوى الخامس',
    'المستوى السادس'
  ];

  const subjects = [
    'التربية الإسلامية',
    'اللغة العربية',
    'الرياضيات',
    'النشاط العلمي'
  ];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const response = await fetch('/api/gemini/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ level, subject, topic, instructions })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'فشل في توليد الأسئلة من الخادم.');
      }

      const rawQuestions = data.questions;
      if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        throw new Error('الاستجابة المستلمة لا تحتوي على أسئلة صالحة.');
      }

      // Standardize generated questions
      const processedQuestions = rawQuestions.map((q: any, i: number) => ({
        id: `q-gen-${Date.now()}-${i}`,
        subject,
        level,
        subComponent: q.subComponent || 'عام',
        text: q.text,
        options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['خيّار أ', 'خيّار ب', 'خيّار ج', 'خيّار د'],
        correctIndex: typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < 4 ? q.correctIndex : 0,
        points: q.points || 1000,
        timeLimit: q.timeLimit || 20
      }));

      const newQuiz: QuizSet = {
        id: `quiz-gen-${Date.now()}`,
        title: `تحدي الذكاء الاصطناعي: ${topic || 'مسابقة مبتكرة'}`,
        description: `تحدي تفاعلي مولد بواسطة الذكاء الاصطناعي للمستوى ${level} في مادة ${subject}.`,
        level,
        subject,
        questions: processedQuestions
      };

      onQuizAdded(newQuiz);
      setSuccessMsg(`تم توليد المسابقة بنجاح بحمولة ${processedQuestions.length} أسئلة ذكية! 🚀`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'فشل توليد التحدي الذكي. يرجى التأكد من توفر مفتاح GEMINI_API_KEY.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-slate-100 p-6 rounded-3xl border border-indigo-800/60 shadow-xl relative overflow-hidden" dir="rtl">
      {/* Radiant Background Glows */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-505/10 rounded-full blur-2xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-indigo-505/10 rounded-full blur-2xl pointer-events-none"></div>

      <div className="flex items-center gap-3 border-b border-indigo-800/50 pb-4 mb-5">
        <div className="bg-emerald-500/10 p-2.5 rounded-2xl border border-emerald-500/20 text-emerald-400">
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h4 className="font-extrabold text-base text-teal-200 flex items-center gap-1.5">
            مُولِّد التحديات التعليمية بالذكاء الاصطناعي 🧠🪄
          </h4>
          <p className="text-[11px] text-slate-400">توليد بيداغوجي ذكي وفوري لأسئلة تفاعلية تثير حماس تلاميذ الغد</p>
        </div>
      </div>

      <form onSubmit={handleGenerate} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 col-span-1">
            <label className="text-xs text-slate-350 font-black block">المستــوى الدراسي للمسابقة</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
            >
              {levels.map((lvl) => (
                <option key={lvl} value={lvl} className="bg-slate-950 text-slate-200">{lvl}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 col-span-1">
            <label className="text-xs text-slate-350 font-black block">المــادة التعليمية المعتمدة</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
            >
              {subjects.map((sub) => (
                <option key={sub} value={sub} className="bg-slate-950 text-slate-200">{sub}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-slate-350 font-black block">الموضوع / الوحدة الدراسية المقررة</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="مثال: التمييز الملفوظ والملحوظ، أو عمليات الضرب البسيطة"
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 font-bold focus:outline-none focus:border-indigo-500 transition-all"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-slate-350 font-black block">توجهات بيداغوجية خاصة للأستاذ(ة) (إختياري)</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="مثال: أسئلة مبهجة وسريعة وتناسب الذكاء اللغوي والرياضي للأطفال..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 font-bold h-16 resize-none focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-350 p-3 rounded-xl flex items-start gap-2 text-xs font-bold leading-relaxed">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-350 p-3 rounded-xl flex items-start gap-2 text-xs font-bold leading-relaxed">
            <Check className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isGenerating}
          className={`w-full py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 border cursor-pointer transition-all shadow-md active:scale-98 ${
            isGenerating
              ? 'bg-indigo-900/60 border-indigo-800 text-indigo-300 pointer-events-none'
              : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 border-emerald-400 text-slate-950 font-black'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader className="w-4 h-4 animate-spin text-emerald-400" />
              <span>جاري توظيف الذكاء الاصطناعي وبناء المسابقة...⏰</span>
            </>
          ) : (
            <>
              <Brain className="w-4 h-4" />
              <span>توليد تحدي تفاعلي مغربي فوري بالكامل ✨</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
