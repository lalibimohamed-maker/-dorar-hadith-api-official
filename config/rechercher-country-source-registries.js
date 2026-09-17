/**
 * Country-level source registries for Rechercher.
 *
 * This is a discovery/provenance layer above the Corpus.  A source is not
 * treated as an API unless its native protocol has been verified.  PDF
 * acquisition remains subject to the source's own access and rights policy.
 */

const source = (id, name, country, kind, url, extra = {}) => ({
  id,
  name,
  country,
  kind,
  url,
  native_protocol: extra.native_protocol ?? 'web-discovery',
  acquisition: extra.acquisition ?? 'metadata-first',
  rights_policy: extra.rights_policy ?? 'source-declared',
  enabled: extra.enabled ?? true,
  notes: extra.notes ?? '',
});

export const RECHERCHER_COUNTRY_SOURCE_REGISTRIES = Object.freeze({
  SA: {
    name: 'المملكة العربية السعودية',
    focus: 'مصادر إسلامية ووطنية ومخطوطات ومكتبات رقمية',
    sources: [
      source('sa-kfnl', 'مكتبة الملك فهد الوطنية', 'SA', 'national-library', 'https://kfnl.gov.sa/', { acquisition: 'metadata-and-digital-materials-when-permitted' }),
      source('sa-darah', 'دارة الملك عبدالعزيز', 'SA', 'archives-and-heritage', 'https://darah.org.sa/', { acquisition: 'metadata-and-digital-materials-when-permitted' }),
      source('sa-kawla', 'مجمع الملك عبدالعزيز للمكتبات الوقفية', 'SA', 'waqf-library', 'https://kawla.gov.sa/', { native_protocol: 'digital-repository', acquisition: 'digital-materials-when-permitted' }),
      source('sa-ksaa', 'مجمع الملك سلمان العالمي للغة العربية', 'SA', 'language-and-digital-library', 'https://ksaa.gov.sa/', { acquisition: 'digital-books-when-permitted' }),
      source('sa-moia', 'وزارة الشؤون الإسلامية والدعوة والإرشاد - المكتبة الإلكترونية', 'SA', 'islamic-ministry-library', 'https://ebook.moia.gov.sa/', { native_protocol: 'web-library', acquisition: 'public-electronic-books-when-permitted' }),
      source('sa-libraries-manuscripts', 'هيئة المكتبات - إتاحة المخطوطات', 'SA', 'manuscript-platform', 'https://libraries.moc.gov.sa/ar/manuscripts', { native_protocol: 'digital-catalog', acquisition: 'manuscript-images-when-permitted' }),
      source('sa-gph-library', 'مكتبة المسجد الحرام', 'SA', 'haramain-library', 'https://library.gph.gov.sa/', { acquisition: 'catalog-and-requested-copies-when-permitted' }),
      source('sa-nabawi-library', 'مكتبة المسجد النبوي', 'SA', 'haramain-library', 'https://alharamain.gov.sa/public/?page=nabawi-library-ar', { acquisition: 'catalog-and-digital-materials-when-permitted' }),
      source('sa-sdl', 'المكتبة الرقمية السعودية', 'SA', 'academic-digital-library', 'https://sdl.edu.sa/', { acquisition: 'licensed-access-only' }),
      source('sa-kau-repository', 'مستودع جامعة الملك عبدالعزيز', 'SA', 'university-repository', 'https://repository.kau.edu.sa/', { acquisition: 'open-items-when-permitted' }),
      source('sa-ksu-repository', 'المستودع الرقمي لجامعة الملك سعود', 'SA', 'university-repository', 'https://repository.ksu.edu.sa/', { acquisition: 'open-items-when-permitted' }),
      source('sa-imamu-repository', 'المستودع الرقمي لجامعة الإمام محمد بن سعود الإسلامية', 'SA', 'islamic-university-repository', 'https://repository.imamu.edu.sa/', { acquisition: 'open-items-when-permitted' }),
      source('sa-iu-repository', 'المستودع الرقمي للجامعة الإسلامية بالمدينة المنورة', 'SA', 'islamic-university-repository', 'https://dspace.iu.edu.sa/', { acquisition: 'open-items-when-permitted' }),
      source('sa-ummalqura', 'مستودع جامعة أم القرى', 'SA', 'university-repository', 'https://drepo.uqu.edu.sa/', { acquisition: 'open-items-when-permitted' }),
      source('sa-qassim', 'المستودع الرقمي لجامعة القصيم', 'SA', 'university-repository', 'https://qspace.qu.edu.sa/', { acquisition: 'open-items-when-permitted' }),
      source('sa-taibah', 'المستودع الرقمي لجامعة طيبة', 'SA', 'university-repository', 'https://dspace.taibahu.edu.sa/', { acquisition: 'open-items-when-permitted' }),
      source('sa-jazan', 'المستودع الرقمي لجامعة جازان', 'SA', 'university-repository', 'https://dspace.jazanu.edu.sa/', { acquisition: 'open-items-when-permitted' }),
      source('sa-najran', 'المستودع الرقمي لجامعة نجران', 'SA', 'university-repository', 'https://repository.nu.edu.sa/', { acquisition: 'open-items-when-permitted' }),
      source('sa-tabuk', 'المستودع الرقمي لجامعة تبوك', 'SA', 'university-repository', 'https://repository.ut.edu.sa/', { acquisition: 'open-items-when-permitted' }),
      source('sa-jouf', 'المستودع الرقمي لجامعة الجوف', 'SA', 'university-repository', 'https://repository.ju.edu.sa/', { acquisition: 'open-items-when-permitted' }),
      source('sa-watheqa', 'مكتبة وثيقة الرقمية', 'SA', 'legal-and-government-library', 'https://watheqa.gov.sa/', { acquisition: 'metadata-and-access-controlled-materials' }),
    ],
  },

  AE: {
    name: 'الإمارات العربية المتحدة',
    sources: [
      source('ae-dar-al-kutub', 'دار الكتب - دائرة الثقافة والسياحة أبوظبي', 'AE', 'national-library', 'https://dct.gov.ae/ar/what.we.do/national.library.aspx', { acquisition: 'catalog-and-digital-materials-when-permitted' }),
      source('ae-al-jami-library', 'مكتبة الجامع - مركز جامع الشيخ زايد الكبير', 'AE', 'islamic-library', 'https://www.szgmc.gov.ae/ar/al-jami-library/library', { native_protocol: 'digital-library', acquisition: 'books-and-manuscripts-when-permitted' }),
      source('ae-sharjah-digital-repository', 'المستودع الرقمي لمكتبة الشارقة', 'AE', 'digital-repository', 'https://sdr.shjlib.gov.ae/', { native_protocol: 'repository', acquisition: 'open-items-when-permitted' }),
      source('ae-uaeu-repository', 'مستودع جامعة الإمارات العربية المتحدة', 'AE', 'university-repository', 'https://scholarworks.uaeu.ac.ae/', { acquisition: 'open-items-when-permitted' }),
      source('ae-iacad', 'دائرة الشؤون الإسلامية والعمل الخيري بدبي', 'AE', 'islamic-affairs', 'https://iacad.gov.ae/', { acquisition: 'publications-when-permitted' }),
    ],
  },

  QA: {
    name: 'دولة قطر',
    sources: [
      source('qa-qdl', 'مكتبة قطر الرقمية', 'QA', 'digital-library', 'https://www.qdl.qa/', { native_protocol: 'iiif-or-repository', acquisition: 'digital-materials-when-permitted' }),
      source('qa-awqaf-kshaf', 'كشاف الوقف', 'QA', 'waqf-bibliography', 'https://kshaf.awqaf.gov.qa/', { native_protocol: 'digital-catalog', acquisition: 'metadata-first' }),
      source('qa-qnl', 'مكتبة قطر الوطنية', 'QA', 'national-library', 'https://www.qnl.qa/', { acquisition: 'catalog-and-digital-materials-when-permitted' }),
      source('qa-hbku-repository', 'مستودع جامعة حمد بن خليفة', 'QA', 'university-repository', 'https://repository.hbku.edu.qa/', { acquisition: 'open-items-when-permitted' }),
    ],
  },

  KW: {
    name: 'دولة الكويت',
    sources: [
      source('kw-national-library', 'مكتبة الكويت الوطنية', 'KW', 'national-library', 'https://www.nlk.gov.kw/', { acquisition: 'catalog-and-digital-materials-when-permitted' }),
      source('kw-awqaf', 'وزارة الأوقاف والشؤون الإسلامية', 'KW', 'islamic-affairs', 'https://www.awqaf.gov.kw/', { acquisition: 'publications-when-permitted' }),
      source('kw-ku-repository', 'مستودع جامعة الكويت', 'KW', 'university-repository', 'https://repository.ku.edu.kw/', { acquisition: 'open-items-when-permitted' }),
    ],
  },

  BH: {
    name: 'مملكة البحرين',
    sources: [
      source('bh-national-library', 'مكتبة البحرين الوطنية', 'BH', 'national-library', 'https://www.bahrain.bh/', { acquisition: 'catalog-and-digital-materials-when-permitted' }),
      source('bh-islamic-affairs', 'وزارة العدل والشؤون الإسلامية والأوقاف', 'BH', 'islamic-affairs', 'https://www.islam.gov.bh/', { acquisition: 'publications-when-permitted' }),
      source('bh-uob-repository', 'مستودع جامعة البحرين', 'BH', 'university-repository', 'https://repository.uob.edu.bh/', { acquisition: 'open-items-when-permitted' }),
    ],
  },

  OM: {
    name: 'سلطنة عُمان',
    sources: [
      source('om-national-library', 'هيئة الوثائق والمحفوظات الوطنية', 'OM', 'archives', 'https://nraa.gov.om/', { acquisition: 'catalog-and-digitized-materials-when-permitted' }),
      source('om-ministry-endowments', 'وزارة الأوقاف والشؤون الدينية', 'OM', 'islamic-affairs', 'https://mara.gov.om/', { acquisition: 'publications-when-permitted' }),
      source('om-sultan-qaboos-repository', 'المستودع البحثي لجامعة السلطان قابوس', 'OM', 'university-repository', 'https://www.squ.edu.om/', { acquisition: 'open-items-when-permitted' }),
    ],
  },

  JO: {
    name: 'المملكة الأردنية الهاشمية',
    sources: [
      source('jo-national-library', 'دائرة المكتبة الوطنية الأردنية', 'JO', 'national-library', 'https://nl.gov.jo/', { acquisition: 'catalog-and-digital-materials-when-permitted' }),
      source('jo-awqaf', 'وزارة الأوقاف والشؤون والمقدسات الإسلامية', 'JO', 'islamic-affairs', 'https://www.awqaf.gov.jo/', { acquisition: 'publications-when-permitted' }),
      source('jo-yarmouk-repository', 'مستودع جامعة اليرموك', 'JO', 'university-repository', 'https://repository.yu.edu.jo/', { acquisition: 'open-items-when-permitted' }),
    ],
  },

  EG: {
    name: 'جمهورية مصر العربية',
    sources: [
      source('eg-dar-al-kutub', 'دار الكتب والوثائق القومية', 'EG', 'national-library-and-archives', 'https://www.darelkotob.gov.eg/', { acquisition: 'catalog-and-digital-materials-when-permitted' }),
      source('eg-al-azhar', 'جامعة الأزهر', 'EG', 'islamic-university', 'https://www.azhar.edu.eg/', { acquisition: 'open-items-when-permitted' }),
      source('eg-ministry-awqaf', 'وزارة الأوقاف المصرية', 'EG', 'islamic-affairs', 'https://awkafonline.gov.eg/', { acquisition: 'publications-when-permitted' }),
      source('eg-alaqsa-repository', 'المكتبة الرقمية المصرية', 'EG', 'national-digital-library', 'https://www.ekb.eg/', { acquisition: 'access-controlled-and-open-materials' }),
    ],
  },

  MA: {
    name: 'المملكة المغربية',
    sources: [
      source('ma-national-library', 'المكتبة الوطنية للمملكة المغربية', 'MA', 'national-library', 'https://www.bnrm.ma/', { acquisition: 'catalog-and-digital-materials-when-permitted' }),
      source('ma-king-hassan-ii-library', 'خزانة جامع القرويين ومؤسسات المخطوطات', 'MA', 'heritage-and-manuscripts', 'https://www.habous.gov.ma/', { acquisition: 'manuscripts-when-permitted' }),
      source('ma-habous', 'وزارة الأوقاف والشؤون الإسلامية', 'MA', 'islamic-affairs', 'https://www.habous.gov.ma/', { acquisition: 'publications-when-permitted' }),
      source('ma-mohammed-v-repository', 'مستودعات جامعة محمد الخامس', 'MA', 'university-repository', 'https://www.um5.ac.ma/', { acquisition: 'open-items-when-permitted' }),
    ],
  },

  DZ: {
    name: 'الجمهورية الجزائرية الديمقراطية الشعبية',
    sources: [
      source('dz-national-library', 'المكتبة الوطنية الجزائرية', 'DZ', 'national-library', 'https://www.biblionat.dz/', { acquisition: 'catalog-and-digital-materials-when-permitted' }),
      source('dz-national-archives', 'المركز الوطني للأرشيف', 'DZ', 'archives', 'https://archivesnationales.dz/', { acquisition: 'catalog-and-digitized-materials-when-permitted' }),
      source('dz-ministry-religious-affairs', 'وزارة الشؤون الدينية والأوقاف', 'DZ', 'islamic-affairs', 'https://www.marw.dz/', { acquisition: 'publications-when-permitted' }),
      source('dz-emir-abdelkader-university', 'جامعة الأمير عبد القادر للعلوم الإسلامية', 'DZ', 'islamic-university', 'https://www.univ-emir.dz/', { acquisition: 'open-items-when-permitted' }),
    ],
  },

  TN: {
    name: 'الجمهورية التونسية',
    sources: [
      source('tn-national-library', 'المكتبة الوطنية التونسية', 'TN', 'national-library', 'https://www.bnt.nat.tn/', { acquisition: 'catalog-and-digital-materials-when-permitted' }),
      source('tn-zitouna', 'جامعة الزيتونة', 'TN', 'islamic-university', 'https://www.uz.rnu.tn/', { acquisition: 'open-items-when-permitted' }),
      source('tn-religious-affairs', 'وزارة الشؤون الدينية', 'TN', 'islamic-affairs', 'https://www.affaires-religieuses.tn/', { acquisition: 'publications-when-permitted' }),
    ],
  },

  MR: {
    name: 'الجمهورية الإسلامية الموريتانية',
    sources: [
      source('mr-national-library', 'المكتبة الوطنية الموريتانية', 'MR', 'national-library', 'https://bibliotheque-nationale.gov.mr/', { acquisition: 'catalog-and-manuscripts-when-permitted' }),
      source('mr-mauritanian-manuscripts', 'المخطوطات الموريتانية والتراث العلمي', 'MR', 'manuscripts', 'https://www.culture.gov.mr/', { acquisition: 'metadata-and-digitized-materials-when-permitted' }),
      source('mr-islamic-university', 'جامعة العلوم الإسلامية بلعيون', 'MR', 'islamic-university', 'https://www.islamicuniversity.mr/', { acquisition: 'open-items-when-permitted' }),
    ],
  },

  SD: {
    name: 'جمهورية السودان',
    sources: [
      source('sd-national-library', 'المكتبة الوطنية السودانية', 'SD', 'national-library', 'https://www.culture.gov.sd/', { acquisition: 'catalog-and-digital-materials-when-permitted' }),
      source('sd-omdurman-islamic', 'جامعة أم درمان الإسلامية', 'SD', 'islamic-university', 'https://oiu.edu.sd/', { acquisition: 'open-items-when-permitted' }),
      source('sd-khartoum-repository', 'مستودع جامعة الخرطوم', 'SD', 'university-repository', 'https://repository.uofk.edu/', { acquisition: 'open-items-when-permitted' }),
    ],
  },

  YE: {
    name: 'الجمهورية اليمنية',
    sources: [
      source('ye-national-library', 'المكتبة الوطنية اليمنية', 'YE', 'national-library', 'https://www.culture.gov.ye/', { acquisition: 'catalog-and-digital-materials-when-permitted' }),
      source('ye-ministry-endowments', 'وزارة الأوقاف والإرشاد', 'YE', 'islamic-affairs', 'https://www.mara.gov.ye/', { acquisition: 'publications-when-permitted' }),
      source('ye-iman-university', 'جامعة الإيمان', 'YE', 'islamic-university', 'https://www.aleman.edu.ye/', { acquisition: 'open-items-when-permitted' }),
    ],
  },

  IQ: {
    name: 'جمهورية العراق',
    sources: [
      source('iq-national-library', 'دار الكتب والوثائق العراقية', 'IQ', 'national-library-and-archives', 'https://www.iraqnla.gov.iq/', { acquisition: 'catalog-and-digital-materials-when-permitted' }),
      source('iq-ministry-endowments-sunni', 'ديوان الوقف السني', 'IQ', 'sunni-islamic-affairs', 'https://www.suniaffairs.gov.iq/', { acquisition: 'publications-when-permitted', notes: 'مصدر سني مؤسسي؛ لا يُفترض أن يمثل جميع المذاهب أو الجهات العراقية.' }),
      source('iq-baghdad-university-repository', 'مستودع جامعة بغداد', 'IQ', 'university-repository', 'https://repository.uobaghdad.edu.iq/', { acquisition: 'open-items-when-permitted' }),
    ],
  },

  PS: {
    name: 'فلسطين',
    sources: [
      source('ps-national-library', 'المكتبة الوطنية الفلسطينية', 'PS', 'national-library', 'https://www.plib.ps/', { acquisition: 'catalog-and-digital-materials-when-permitted' }),
      source('ps-awqaf', 'وزارة الأوقاف والشؤون الدينية الفلسطينية', 'PS', 'islamic-affairs', 'https://www.pal-wakf.ps/', { acquisition: 'publications-when-permitted' }),
      source('ps-birzeit-repository', 'مستودع جامعة بيرزيت', 'PS', 'university-repository', 'https://fada.birzeit.edu/', { acquisition: 'open-items-when-permitted' }),
    ],
  },

  SY: {
    name: 'الجمهورية العربية السورية',
    sources: [
      source('sy-national-library', 'المكتبة الوطنية السورية', 'SY', 'national-library', 'https://www.moc.gov.sy/', { acquisition: 'catalog-and-digital-materials-when-permitted' }),
      source('sy-ministry-awqaf', 'وزارة الأوقاف السورية', 'SY', 'islamic-affairs', 'https://www.awqaf.gov.sy/', { acquisition: 'publications-when-permitted' }),
      source('sy-damascus-university', 'مستودع جامعة دمشق', 'SY', 'university-repository', 'https://dspace.univ-damascus.edu.sy/', { acquisition: 'open-items-when-permitted' }),
    ],
  },

  LB: {
    name: 'الجمهورية اللبنانية',
    sources: [
      source('lb-national-library', 'المكتبة الوطنية اللبنانية', 'LB', 'national-library', 'https://nla.gov.lb/', { acquisition: 'catalog-and-digital-materials-when-permitted' }),
      source('lb-dar-el-fatwa', 'دار الفتوى اللبنانية', 'LB', 'sunni-islamic-affairs', 'https://www.dar-alifta.gov.lb/', { acquisition: 'publications-when-permitted' }),
      source('lb-aub-repository', 'مستودع الجامعة الأمريكية في بيروت', 'LB', 'university-repository', 'https://scholarworks.aub.edu.lb/', { acquisition: 'open-items-when-permitted' }),
    ],
  },

  LY: {
    name: 'دولة ليبيا',
    sources: [
      source('ly-national-library', 'دار الكتب الوطنية الليبية', 'LY', 'national-library', 'https://www.culture.gov.ly/', { acquisition: 'catalog-and-digital-materials-when-permitted' }),
      source('ly-awqaf', 'الهيئة العامة للأوقاف والشؤون الإسلامية', 'LY', 'islamic-affairs', 'https://awkaf.gov.ly/', { acquisition: 'publications-when-permitted' }),
      source('ly-tripoli-university', 'مستودع جامعة طرابلس', 'LY', 'university-repository', 'https://repository.uot.edu.ly/', { acquisition: 'open-items-when-permitted' }),
    ],
  },

  DJ: {
    name: 'جمهورية جيبوتي',
    sources: [
      source('dj-national-library', 'المكتبة الوطنية في جيبوتي', 'DJ', 'national-library', 'https://www.gouv.dj/', { acquisition: 'metadata-first' }),
      source('dj-islamic-affairs', 'وزارة الشؤون الإسلامية والثقافة والأوقاف', 'DJ', 'islamic-affairs', 'https://www.gouv.dj/', { acquisition: 'publications-when-permitted' }),
    ],
  },

  SO: {
    name: 'جمهورية الصومال الفيدرالية',
    sources: [
      source('so-national-library', 'المكتبة الوطنية الصومالية', 'SO', 'national-library', 'https://moe.gov.so/', { acquisition: 'metadata-first' }),
      source('so-religious-affairs', 'وزارة الأوقاف والشؤون الدينية', 'SO', 'islamic-affairs', 'https://moccr.gov.so/', { acquisition: 'publications-when-permitted' }),
      source('so-simad-university', 'مستودعات الجامعات الصومالية', 'SO', 'university-repository', 'https://simad.edu.so/', { acquisition: 'open-items-when-permitted' }),
    ],
  },

  KM: {
    name: 'اتحاد جزر القمر',
    sources: [
      source('km-national-archives', 'المؤسسات الوطنية للتراث والثقافة في جزر القمر', 'KM', 'heritage', 'https://beit-salam.km/', { acquisition: 'metadata-first' }),
      source('km-islamic-affairs', 'المؤسسات الدينية والتعليمية الإسلامية في جزر القمر', 'KM', 'islamic-affairs', 'https://beit-salam.km/', { acquisition: 'metadata-first' }),
    ],
  },
});

export const RECHERCHER_COUNTRY_CODES = Object.freeze(Object.keys(RECHERCHER_COUNTRY_SOURCE_REGISTRIES));

export function flattenCountrySources(registry = RECHERCHER_COUNTRY_SOURCE_REGISTRIES) {
  return Object.values(registry).flatMap((country) => country.sources);
}

export function sourcesForCountry(countryCode) {
  return RECHERCHER_COUNTRY_SOURCE_REGISTRIES[countryCode]?.sources ?? [];
}
