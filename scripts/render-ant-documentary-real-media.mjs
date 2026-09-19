import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const manifestPath = 'config/video-prototypes/ant-documentary-real-media-2026.json';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const outDir = 'dist/video-prototypes/ant-communication-27-18-real-media';
const rawDir = join(outDir, 'raw-media');
const workDir = join(outDir, 'work');
mkdirSync(rawDir, { recursive: true });
mkdirSync(workDir, { recursive: true });

const run = (cmd, args, options = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...options });
const capture = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim();

function sha256(path) {
  const data = readFileSync(path);
  return createHash('sha256').update(data).digest('hex');
}

function getCommonsFileInfo(filename) {
  const title = `File:${filename}`;
  const api = new URL('https://commons.wikimedia.org/w/api.php');
  api.searchParams.set('action', 'query');
  api.searchParams.set('prop', 'imageinfo');
  api.searchParams.set('iiprop', 'url|mime|size|sha1');
  api.searchParams.set('format', 'json');
  api.searchParams.set('formatversion', '2');
  api.searchParams.set('titles', title);
  const json = JSON.parse(capture('curl', ['-fsSL', '--retry', '3', '--connect-timeout', '20', api.toString()]));
  const page = json?.query?.pages?.[0];
  const info = page?.imageinfo?.[0];
  if (!info?.url) throw new Error(`Commons API did not return a media URL for ${filename}`);
  return { sourceUrl: info.url, mime: info.mime, size: info.size, sha1: info.sha1 ?? null };
}

const resolvedAssets = [];
for (const asset of manifest.mediaAssets) {
  const target = join(rawDir, asset.filename.replace(/[^A-Za-z0-9._-]+/g, '_'));
  const meta = getCommonsFileInfo(asset.filename);
  run('curl', ['-fL', '--retry', '3', '--retry-delay', '2', '--connect-timeout', '30', meta.sourceUrl, '-o', target]);
  const actualSha256 = sha256(target);
  resolvedAssets.push({ ...asset, fetchedUrl: meta.sourceUrl, mime: meta.mime, bytes: meta.size, commonsSha1: meta.sha1, sha256: actualSha256, localPath: target });
}

function writeAss(path, events) {
  const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Title,Noto Sans Arabic,50,&H00F7F4E6,&H00F7F4E6,&H00101810,&H88000000,1,0,0,0,100,100,0,0,1,2,1,8,70,70,40,1\nStyle: Body,Noto Sans Arabic,38,&H00FFFFFF,&H00FFFFFF,&H00101810,&H99000000,0,0,0,0,100,100,0,0,1,2,1,2,75,75,55,1\nStyle: Credit,DejaVu Sans,24,&H00E8D7AA,&H00E8D7AA,&H00101810,&H99000000,0,0,0,0,100,100,0,0,1,1,0,7,55,55,35,1\nStyle: Evidence,Noto Sans Arabic,32,&H00DCEBFF,&H00DCEBFF,&H00101810,&H99000000,0,0,0,0,100,100,0,0,1,2,0,2,75,75,18,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  writeFileSync(path, header + events.map(e => `Dialogue: 0,${e.start},${e.end},${e.style},,0,0,0,,${e.text}`).join('\n') + '\n', 'utf8');
}

function assTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toFixed(2).padStart(5, '0');
  return `${h}:${String(m).padStart(2, '0')}:${s}`;
}

function makeCard(name, duration, events) {
  const ass = join(workDir, `${name}.ass`);
  writeAss(ass, events);
  const out = join(workDir, `${name}.mp4`);
  const color = name === 'quran' ? '0a0b10' : '07131c';
  run('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', `color=c=${color}:s=1920x1080:r=30:d=${duration}`,
    '-vf', `subtitles=${ass}`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    out
  ]);
  return out;
}

const sceneMeta = {};
const clips = [];

clips.push(makeCard('title', 4, [
  { start: '0:00:00.00', end: '0:00:04.00', style: 'Title', text: 'النمل — عالمٌ من التواصل والتنظيم' },
  { start: '0:00:00.00', end: '0:00:04.00', style: 'Body', text: 'فيلم قصير من إنشاء موسوعة دين الله • مبني على وسائط حقيقية مفتوحة الترخيص' }
]));
sceneMeta.s0 = { start: 0, duration: 4, type: 'title' };

const realSceneSpecs = [
  { id: 's1', asset: 'leafcutter-ants-gails', duration: 8, title: 'سلوك جماعي مرئي', body: 'نمل قاطع الأوراق يتحرك ويحمل أجزاء من النبات ضمن مسار جماعي.', style: 'real_footage' },
  { id: 's2', asset: 'industrious-ants-gails', duration: 8, title: 'نشاط داخل المستعمرة', body: 'لقطة طبيعية لحركة النمل وتعاونه في البيئة المحيطة.', style: 'real_footage' },
  { id: 's3', asset: 'ants-larvae-osseous', duration: 10, title: 'داخل المستعمرة', body: 'النمل واليرقات: جانب من دورة الحياة داخل مجتمع النمل.', style: 'real_footage' },
  { id: 's4', asset: 'busy-ants-jun-seita', duration: 10, title: 'حركة جماعية كثيفة', body: 'تجمع كبير من النمل يعمل ويتحرك في وقت واحد بعد المطر.', style: 'real_footage' },
  { id: 's5', asset: 'large-number-ants-dineen', duration: 8, title: 'شبكة من الأفراد', body: 'لقطة واسعة تُظهر كثافة الحركة الجماعية.', style: 'real_footage' }
];

for (const spec of realSceneSpecs) {
  const asset = resolvedAssets.find(a => a.id === spec.asset);
  if (!asset) throw new Error(`Missing asset ${spec.asset}`);
  const normalized = join(workDir, `${spec.id}.mp4`);
  run('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-i', asset.localPath,
    '-t', String(spec.duration),
    '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1',
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    normalized
  ]);
  const ass = join(workDir, `${spec.id}.ass`);
  writeAss(ass, [
    { start: '0:00:00.00', end: assTime(spec.duration), style: 'Title', text: spec.title },
    { start: '0:00:00.40', end: assTime(spec.duration - 0.1), style: 'Body', text: spec.body },
    { start: '0:00:00.00', end: assTime(spec.duration), style: 'Credit', text: `Footage: ${asset.author} / Wikimedia Commons — ${asset.license}` }
  ]);
  const captioned = join(workDir, `${spec.id}-captioned.mp4`);
  run('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-i', normalized,
    '-vf', `subtitles=${ass}`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    captioned
  ]);
  clips.push(captioned);
  sceneMeta[spec.id] = { duration: spec.duration, type: spec.style, asset: asset.id, title: spec.title, body: spec.body };
}

const evidenceClip = makeCard('evidence', 9, [
  { start: '0:00:00.00', end: '0:00:09.00', style: 'Title', text: 'من المشهد إلى الدليل' },
  { start: '0:00:00.20', end: '0:00:09.00', style: 'Body', text: 'الدراسات تصف قنوات كيميائية وآلية، كما تصف إشارات اهتزازية تختلف باختلاف السياق السلوكي.' },
  { start: '0:00:05.00', end: '0:00:09.00', style: 'Evidence', text: 'Hölldobler 1978 • Masoni et al. 2021 • المصادر والـDOI في سجل التوثيق' }
]);
clips.push(evidenceClip);
sceneMeta.s6 = { duration: 9, type: 'evidence', evidence: manifest.evidence.map(e => e.id) };

const quranClip = makeCard('quran', 9, [
  { start: '0:00:00.00', end: '0:00:09.00', style: 'Title', text: 'الشاهد القرآني' },
  { start: '0:00:01.00', end: '0:00:07.50', style: 'Body', text: '﴿حَتَّىٰٓ إِذَآ أَتَوْا۟ عَلَىٰ وَادِ ٱلنَّمْلِ قَالَتْ نَمْلَةٌۭ يَـٰٓأَيُّهَا ٱلنَّمْلُ ٱدْخُلُوا۟ مَسَـٰكِنَكُمْ﴾' },
  { start: '0:00:07.50', end: '0:00:09.00', style: 'Evidence', text: 'سورة النمل • 18 • لا تلاوة قرآنية مُولَّدة أو غير مرخّصة في هذا النموذج' }
]);
clips.push(quranClip);
sceneMeta.s7 = { duration: 9, type: 'quran', verse: '27:18', source: 'https://quran.com/27:18' };

const concatList = join(workDir, 'concat.txt');
writeFileSync(concatList, clips.map(file => `file '${file.replaceAll("'", "'\\''")}'`).join('\n') + '\n', 'utf8');
const final = join(outDir, 'ant-documentary-real-media.mp4');
run('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', concatList,
  '-c', 'copy', '-movflags', '+faststart', final
]);

const narration = 'هذا فيلم قصير عن عالم النمل. نرى سلوكًا جماعيًا متنوعًا داخل المستعمرات، ثم ننتقل من الصورة إلى الدليل العلمي. تصف الدراسات التواصل الكيميائي وآليات أخرى في مجتمعات النمل، كما وجدت دراسة مفتوحة الوصول أن الإشارات الاهتزازية في أحد الأنواع المدروسة تختلف باختلاف السياق السلوكي. ثم نعود إلى الشاهد القرآني في سورة النمل، الآية الثامنة عشرة. ومنهج الموسوعة هنا واضح: نثبت المعلومة بمصدرها، ونفصل بين النتيجة العلمية وبين الصلة التفسيرية، ولا نحول الربط إلى دعوى إعجازية آلية.';
writeFileSync(join(outDir, 'narration.txt'), narration, 'utf8');
run('espeak-ng', ['-v', 'ar', '-s', '132', '-f', join(outDir, 'narration.txt'), '-w', join(outDir, 'narration.wav')]);
const withAudio = join(outDir, 'ant-documentary-real-media-with-audio.mp4');
run('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error', '-i', final, '-i', join(outDir, 'narration.wav'),
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', withAudio
]);

writeFileSync(join(outDir, 'scene-provenance.json'), JSON.stringify({
  prototypeId: manifest.prototypeId,
  generatedAt: new Date().toISOString(),
  finalVideo: basename(withAudio),
  scenes: sceneMeta,
  mediaAssets: resolvedAssets.map(({ localPath, ...rest }) => rest),
  evidence: manifest.evidence,
  quran: { reference: '27:18', source: 'https://quran.com/27:18' },
  policy: manifest.rightsPolicy
}, null, 2), 'utf8');

writeFileSync(join(outDir, 'PROVENANCE.md'), [
  '# Ant documentary real-media benchmark provenance',
  '',
  'This benchmark uses real Wikimedia Commons video assets listed below under CC BY 2.0. Each real-media scene has a persistent source credit in the video and a machine-readable provenance record.',
  '',
  ...resolvedAssets.map((a, i) => `${i + 1}. **${a.filename}** — ${a.author} — ${a.license}\n   - Source page: ${a.sourcePage}\n   - Retrieved media URL: ${a.fetchedUrl}\n   - SHA-256: ${a.sha256}`),
  '',
  '## Scientific evidence',
  '- Hölldobler (1978), *Ethological Aspects of Chemical Communication in Ants*: https://doi.org/10.1016/S0065-3454(08)60132-1',
  '- Masoni et al. (2021), *Ants modulate stridulatory signals depending on the behavioural context*: https://doi.org/10.1038/s41598-021-84925-z',
  '',
  '## Quranic layer',
  '- Surah An-Naml 27:18: https://quran.com/27:18',
  '- This benchmark does not synthesize or embed Quranic recitation.',
  '',
  '## Rights policy',
  '- Public availability is not treated as permission.',
  '- Only asset-specific cleared candidates enter this benchmark.',
  '- Editorial cropping/resizing is applied with attribution.',
  '- Secondary interpretive sources such as kaheel7 are discovery/interpretation leads; scientific classification remains tied to primary/authoritative evidence.'
].join('\n'), 'utf8');

console.log(`Rendered ${withAudio}`);
