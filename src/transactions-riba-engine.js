const SOURCES = {
  quranRiba: { kind:'quran', references:['2:275-279','3:130','4:29'] },
  muslimGold: { kind:'hadith', book:'صحيح مسلم', locator:'كتاب البيوع، باب الصرف وبيع الذهب بالورق نقداً', note:'أصل باب الربا في الأصناف الربوية والصرف' },
  bukhariRiba: { kind:'hadith', book:'صحيح البخاري', locator:'كتاب البيوع، أبواب الربا والصرف', note:'أحاديث الربا والصرف' },
  muslimGharar: { kind:'hadith', book:'صحيح مسلم', locator:'كتاب البيوع، باب بطلان بيع الحصاة والبيع الذي فيه غرر', note:'النهي عن الغرر' },
  muslimDebts: { kind:'hadith', book:'صحيح مسلم', locator:'كتاب المساقاة/البيوع، أبواب الديون والمعاملات', note:'أصول معاملات الديون' }
};

const TOPICS = {
  riba_basics:{title:'الربا: تعريفه وصوره الأساسية',aliases:['الربا','ما هو الربا','تحريم الربا'],evidence:['quranRiba','bukhariRiba','muslimGold'],lessons:['الربا من كبائر الذنوب وقد ورد الوعيد الشديد فيه','تمييز ربا الفضل عن ربا النسيئة في الاصطلاح الفقهي','لا يكفي تشابه الاسم التجاري للحكم؛ بل تدرس حقيقة العقد والسلعة وطريقة التقابض'],warnings:['لا يُصدر الحكم على عقد معاصر بمجرد الاسم؛ يجب فحص الشروط والتكييف الفقهي']},
  gold_silver:{title:'بيع الذهب والفضة والصرف',aliases:['بيع الذهب بالذهب','ذهب بذهب','بيع الذهب','الذهب بالفضة','الصرف'],evidence:['muslimGold','bukhariRiba'],lessons:['الأصناف الربوية المنصوص عليها لها أحكام خاصة في مبادلتها','بيع الجنس الربوي بجنسه له شروط المماثلة والتقابض بحسب النص','اختلاف الجنس الربوي لا يلغي شرط التقابض في الصرف'],warnings:['المصوغات والذهب المعاصر تحتاج إلى تكييف فقهي دقيق؛ يعرض التطبيق الأقوال الموثقة ولا يختلق إجماعاً']},
  debt_interest:{title:'الزيادة المشروطة في القرض والدين',aliases:['فائدة القرض','فوائد البنك','زيادة القرض','ربا الديون','قرض بفائدة'],evidence:['quranRiba','bukhariRiba','muslimDebts'],lessons:['يُفحص عقد القرض وشروط الزيادة','يُفصل بين القرض وبين عقود البيع والاستثمار الحقيقية','تُعرض أحكام المؤسسات المالية المعاصرة بفتاوى موثقة وتاريخ إصدارها']},
  gharar:{title:'الغرر والجهالة في البيوع',aliases:['الغرر','بيع الغرر','جهالة في البيع','مخاطرة في البيع'],evidence:['muslimGharar'],lessons:['تعريف الغرر المؤثر','أمثلة البيوع المنهي عنها','تمييز الغرر اليسير المغتفر عن الغرر المؤثر بحسب الفقهاء']},
  forbidden_wealth:{title:'أكل أموال الناس بالباطل وأموال اليتامى',aliases:['أكل أموال الناس','مال اليتيم','أكل مال اليتيم','أموال اليتامى','المال الحرام'],evidence:[{kind:'quran',references:['2:188','4:2','4:10','4:29']}],lessons:['حرمة أكل المال بالباطل','حرمة أكل مال اليتيم إلا بالمعروف في مواضعه الشرعية','تعليم صور الغش والخيانة والرشوة والسرقة والاعتداء على الحقوق']},
  prohibited_trade:{title:'أبواب البيوع المحرمة',aliases:['البيع المحرم','الغش','النجش','بيع ما لا يملك','الاحتكار','القمار','الميسر'],evidence:[{kind:'quran',references:['5:90-91','2:188','83:1-3']},{kind:'hadith',book:'صحيح مسلم',locator:'كتاب البيوع',note:'أبواب الغش والغرر ووجوه البيوع المنهي عنها'}],lessons:['فحص السلعة والملكية والقدرة على التسليم','فحص الغش والتدليس والنجش والغرر','تمييز البيع عن القمار والميسر','عرض الخلاف عند اختلاف الفقهاء في صورة معاصرة']}
};

function normalize(s){return String(s||'').toLocaleLowerCase('ar').normalize('NFKC').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ًٌٍَُِّْـ]/g,'').replace(/\s+/g,' ').trim();}
export function listTransactionTopics(){return Object.entries(TOPICS).map(([id,v])=>({id,title:v.title,aliases:v.aliases}));}
export function getTransactionTopic(id){const t=TOPICS[id]; return t?{id,...t,sources:t.evidence.map(e=>typeof e==='string'?SOURCES[e]:e)}:null;}
export function routeTransactionQuestion(question){const q=normalize(question);const ranked=Object.entries(TOPICS).map(([id,v])=>({id,score:v.aliases.reduce((n,a)=>n+(q.includes(normalize(a))?(normalize(a).includes(' ')?30:10):0),0)})).sort((a,b)=>b.score-a.score);return {engineId:'fiqh-transactions',topicId:ranked[0]?.score?ranked[0].id:null,confidence:ranked[0]?.score?Math.min(ranked[0].score/100,1):0.1,candidates:ranked.filter(x=>x.score>0).slice(0,6)};}
export function buildTransactionLesson(topicId,{language='ar'}={}){const t=getTransactionTopic(topicId);if(!t)return null;return {engineId:'fiqh-transactions',topicId,language,title:t.title,lessons:t.lessons,evidence:t.sources,warnings:t.warnings||[],methodology:'فحص حقيقة العقد، ثم النصوص، ثم التخريج الفقهي، ثم أقوال العلماء المعاصرين الموثقة، مع بيان درجة اليقين والخلاف.'};}
