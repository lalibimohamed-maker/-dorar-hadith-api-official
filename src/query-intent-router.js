const INTENTS = [
  { id:'definition', patterns:['ما هو','ما هي','تعريف','معنى','ما المقصود'], domains:['quran','aqidah','hadith','fiqh','language','seerah'] },
  { id:'evidence', patterns:['دليل','أدلة','من القرآن والسنة','من السنة','بالقرآن','بالحديث','استدل'], domains:['quran','hadith','aqidah','fiqh'] },
  { id:'ghaib', patterns:['الغيب','البرزخ','القبر','البعث','الحشر','الحساب','الجنة','النار','الروح','الملائكة','الجن','الشيطان','الساعة','الدجال','يأجوج','مفاتيح الغيب'], domains:['aqidah','quran','hadith'] },
  { id:'quran_stories', patterns:['قصص القرآن','قصص الأنبياء','قصة نبي','قصص الأنبياء في الكتاب والسنة'], domains:['quran','seerah','hadith'] },
  { id:'scholarly_views', patterns:['قال العلماء','أقوال العلماء','قول ابن القيم','قول ابن كثير','قال ابن تيمية','أقوال السلف'], domains:['biography','aqidah','tafsir','hadith','fiqh'] },
  { id:'comparison', patterns:['قارن','مقارنة','الفرق بين','أقوال المذاهب'], domains:['fiqh','aqidah','tafsir','hadith'] }
];

export function classifyQuery(query = '') {
  const text = String(query).trim().toLowerCase();
  const hits = INTENTS.map(intent => ({
    ...intent,
    score: intent.patterns.reduce((n,p) => n + (text.includes(p.toLowerCase()) ? 1 : 0), 0)
  })).filter(x => x.score > 0).sort((a,b) => b.score - a.score);
  const top = hits[0];
  return {
    intent: top?.id || 'search',
    confidence: top ? Math.min(1, top.score / 2) : 0,
    domains: top?.domains || [],
    evidenceRequired: ['evidence','ghaib','quran_stories','scholarly_views'].includes(top?.id),
    sourceProvenanceRequired: true,
    rejectUnverifiedAsFact: true
  };
}

export function queryPolicy(query='') {
  const classification = classifyQuery(query);
  return {
    ...classification,
    displayPolicy: classification.rejectUnverifiedAsFact
      ? 'verified-first; weak/unknown reports explicitly labelled; no silent conversion to fact'
      : 'source-aware search'
  };
}
