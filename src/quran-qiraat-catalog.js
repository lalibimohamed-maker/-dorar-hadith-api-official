const QIRAAT = Object.freeze([
  { id: 'nafi', nameAr: 'نافع المدني', nameEn: "Nafi' al-Madani", riwayat: ['qalun', 'warsh'] },
  { id: 'ibn-kathir', nameAr: 'ابن كثير المكي', nameEn: 'Ibn Kathir al-Makki', riwayat: ['al-bazzi', 'qunbul'] },
  { id: 'abu-amr', nameAr: 'أبو عمرو البصري', nameEn: 'Abu Amr al-Basri', riwayat: ['al-duri-abu-amr', 'al-susi'] },
  { id: 'ibn-amir', nameAr: 'ابن عامر الشامي', nameEn: 'Ibn Amir al-Shami', riwayat: ['hisham', 'ibn-dhakwan'] },
  { id: 'asim', nameAr: 'عاصم الكوفي', nameEn: 'Asim al-Kufi', riwayat: ['hafs', 'shuba'] },
  { id: 'hamza', nameAr: 'حمزة الكوفي', nameEn: 'Hamza al-Kufi', riwayat: ['khalaf-hamza', 'khallad'] },
  { id: 'al-kisai', nameAr: 'الكسائي الكوفي', nameEn: "Al-Kisa'i al-Kufi", riwayat: ['abu-al-harith', 'al-duri-kisai'] },
  { id: 'abu-jafar', nameAr: 'أبو جعفر المدني', nameEn: "Abu Ja'far al-Madani", riwayat: ['ibn-wardan', 'ibn-jammaz'] },
  { id: 'yaqub', nameAr: 'يعقوب الحضرمي', nameEn: "Ya'qub al-Hadrami", riwayat: ['ruways', 'rawh'] },
  { id: 'khalaf', nameAr: 'خلف العاشر', nameEn: "Khalaf al-'Ashir", riwayat: ['ishaq', 'idris'] },
]);

export const QURAN_QIRAAT_CATALOG = Object.freeze(QIRAAT.map(item => ({
  ...item,
  riwayat: Object.freeze([...item.riwayat]),
})));

export function qiraahById(id) {
  return QURAN_QIRAAT_CATALOG.find(item => item.id === id) || null;
}

export function isValidRiwayah(qiraah, riwayah) {
  return Boolean(qiraahById(qiraah)?.riwayat.includes(riwayah));
}
