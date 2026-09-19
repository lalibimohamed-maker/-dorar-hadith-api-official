import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

const manifestPath = 'config/video-prototypes/ant-documentary-real-media-2026.json';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const outDir = resolve('dist/video-prototypes/ant-communication-27-18-real-media');
const rawDir = join(outDir, 'raw-media');
const workDir = join(outDir, 'work');
mkdirSync(rawDir, { recursive: true });
mkdirSync(workDir, { recursive: true });

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });
const capture = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim();
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');

function getRemoteUrl(asset) {
  const api = new URL('https://commons.wikimedia.org/w/api.php');
  api.searchParams.set('action', 'query');
  api.searchParams.set('prop', 'imageinfo');
  api.searchParams.set('iiprop', 'url|mime|size|sha1');
  api.searchParams.set('format', 'json');
  api.searchParams.set('formatversion', '2');
  api.searchParams.set('titles', `File:${asset.filename}`);
  const json = JSON.parse(capture('curl', ['-fsSL', '--retry', '3', '--connect-timeout', '20', api.toString()]));
  const info = json?.query?.pages?.[0]?.imageinfo?.[0];
  if (!info?.url) throw new Error(`Unable to resolve Wikimedia Commons media: ${asset.filename}`);
  return info;
}

const assets = [];
for (const asset of manifest.mediaAssets) {
  if (!asset.license?.startsWith('CC BY 2.0')) continue;
  const info = getRemoteUrl(asset);
  const path = join(rawDir, asset.filename.replace(/[^A-Za-z0-9._-]+/g, '_'));
  run('curl', ['-fL', '--retry', '3', '--retry-delay', '2', '--connect-timeout', '30', info.url, '-o', path]);
  assets.push({ ...asset, fetchedUrl: info.url, mime: info.mime, bytes: info.size, commonsSha1: info.sha1 ?? null, sha256: sha256(path), localPath: path });
}
if (assets.length < 5) throw new Error('At least five CC BY 2.0 real ant-video assets are required.');

function writeAss(path, events) {
  const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Title,Noto Sans Arabic,52,&H00F8F5E9,&H00F8F5E9,&H00101010,&H90000000,1,0,0,0,100,100,0,0,1,2,1,8,70,70,40,1\nStyle: Body,Noto Sans Arabic,38,&H00FFFFFF,&H00FFFFFF,&H00101010,&H99000000,0,0,0,0,100,100,0,0,1,2,1,2,75,75,55,1\nStyle: Credit,DejaVu Sans,24,&H00E8D5A8,&H00E8D5A8,&H00101010,&H99000000,0,0,0,0,100,100,0,0,1,1,0,7,55,55,32,1\nStyle: Evidence,Noto Sans Arabic,32,&H00DDEBFF,&H00DDEBFF,&H00101010,&H99000000,0,0,0,0,100,100,0,0,1,2,0,2,75,75,20,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  writeFileSync(path, header + events.map(e => `Dialogue: 0,${e.start},${e.end},${e.style},,0,0,0,,${e.text}`).join('\n') + '\n', 'utf8');
}
function time(s) {
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = (s % 60).toFixed(2).padStart(5, '0');
  return `${h}:${String(m).padStart(2, '0')}:${sec}`;
}

function card(name, duration, events) {
  const ass = join(workDir, `${name}.ass`); writeAss(ass, events);
  const out = join(workDir, `${name}.mp4`);
  const bg = name === 'quran' ? '08090d' : '07131d';
  run('ffmpeg', ['-y','-hide_banner','-loglevel','error','-f','lavfi','-i',`color=c=${bg}:s=1920x1080:r=30:d=${duration}`,'-vf',`subtitles=${ass}`,'-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p',out]);
  return out;
}

const clips = [];
const provenance = { prototypeId: manifest.prototypeId, assets: [], scenes: [] };

clips.push(card('title',4,[
  {start:'0:00:00.00',end:'0:00:04.00',style:'Title',text:'النمل — عالمٌ من التواصل والتنظيم'},
  {start:'0:00:00.00',end:'0:00:04.00',style:'Body',text:'فيلم قصير من إنشاء موسوعة دين الله • وسائط حقيقية مفتوحة الترخيص'}
]));
provenance.scenes.push({id:'s0',type:'title',durationSeconds:4});

const specs=[
  ['s1','leafcutter-ants-gails',8,'سلوك جماعي مرئي','نمل قاطع الأوراق يتحرك ويحمل أجزاء من النبات ضمن نشاط جماعي.'],
  ['s2','industrious-ants-gails',8,'نشاط متواصل','حركة طبيعية لأفراد النمل في بيئتهم.'],
  ['s3','ants-larvae-osseous',10,'داخل المستعمرة','النمل واليرقات في جانب من دورة الحياة داخل المجتمع.'],
  ['s4','busy-ants-jun-seita',10,'حركة جماعية كثيفة','لقطة حقيقية لتجمع كبير من النمل بعد المطر.'],
  ['s5','large-number-ants-dineen',8,'شبكة من الأفراد','لقطة واسعة تُظهر كثافة الحركة الجماعية.']
];
for (const [id,assetId,duration,title,body] of specs) {
  const asset=assets.find(a=>a.id===assetId); if(!asset) throw new Error(`Asset not found: ${assetId}`);
  const normalized=join(workDir,`${id}.mp4`);
  run('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',asset.localPath,'-t',String(duration),'-an','-vf','scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p',normalized]);
  const ass=join(workDir,`${id}.ass`); writeAss(ass,[
    {start:'0:00:00.00',end:time(duration),style:'Title',text:title},
    {start:'0:00:00.50',end:time(Math.max(duration-0.2,0.6)),style:'Body',text:body},
    {start:'0:00:00.00',end:time(duration),style:'Credit',text:`Footage: ${asset.author} / Wikimedia Commons — ${asset.license}`}
  ]);
  const captioned=join(workDir,`${id}-captioned.mp4`);
  run('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',normalized,'-vf',`subtitles=${ass}`,'-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p',captioned]);
  clips.push(captioned);
  provenance.assets.push({id:asset.id,filename:asset.filename,sourcePage:asset.sourcePage,author:asset.author,license:asset.license,fetchedUrl:asset.fetchedUrl,commonsSha1:asset.commonsSha1,sha256:asset.sha256,bytes:asset.bytes});
  provenance.scenes.push({id,durationSeconds:duration,type:'real_footage',assetId,title});
}

clips.push(card('evidence',9,[
  {start:'0:00:00.00',end:'0:00:09.00',style:'Title',text:'من المشهد إلى الدليل'},
  {start:'0:00:00.30',end:'0:00:09.00',style:'Body',text:'التواصل عند النمل متعدد القنوات. وتصف دراسة مفتوحة الوصول إشارات اهتزازية تتغير باختلاف السياق السلوكي.'},
  {start:'0:00:06.00',end:'0:00:09.00',style:'Evidence',text:'Masoni et al. 2021 • Hölldobler 1978 • DOI في سجل التوثيق'}
]));
provenance.scenes.push({id:'s6',type:'evidence',durationSeconds:9,evidence:manifest.evidence.map(e=>e.id)});

clips.push(card('quran',9,[
  {start:'0:00:00.00',end:'0:00:09.00',style:'Title',text:'الشاهد القرآني — سورة النمل 18'},
  {start:'0:00:01.00',end:'0:00:07.80',style:'Body',text:'﴿حَتَّىٰٓ إِذَآ أَتَوْا۟ عَلَىٰ وَادِ ٱلنَّمْلِ قَالَتْ نَمْلَةٌۭ يَـٰٓأَيُّهَا ٱلنَّمْلُ ٱدْخُلُوا۟ مَسَـٰكِنَكُمْ﴾'},
  {start:'0:00:07.80',end:'0:00:09.00',style:'Evidence',text:'المعلومة العلمية والآية تُعرضان في مستويين منفصلين؛ لا دعوى إعجاز علمي تلقائية.'}
]));
provenance.scenes.push({id:'s7',type:'quran',durationSeconds:9,reference:'27:18',source:'https://quran.com/27:18'});

const concatList=join(workDir,'concat.txt');
const absoluteLines=clips.map(f=>`file '${resolve(f).replaceAll("'","'\\''")}'`).join('\n')+'\n';
writeFileSync(concatList,absoluteLines,'utf8');
const silent=join(outDir,'ant-documentary-real-media.mp4');
run('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',concatList,'-c','copy','-movflags','+faststart',silent]);

const narration='هذا فيلم قصير عن عالم النمل. نرى مشاهد حقيقية للنمل وهو يتحرك ويتعاون داخل المستعمرة. ثم ننتقل من الصورة إلى الدليل العلمي. تصف الأدبيات العلمية قنوات متعددة للتواصل عند النمل، وتبين دراسة مفتوحة الوصول أن الإشارات الاهتزازية في نوع مدروس تتغير باختلاف السياق السلوكي. ثم نعرض الشاهد القرآني من سورة النمل. ومنهج موسوعة دين الله هو توثيق المعلومة بمصدرها، والفصل بين النتيجة العلمية وبين الصلة التفسيرية.';
writeFileSync(join(outDir,'narration.txt'),narration,'utf8');
run('espeak-ng',['-v','ar','-s','132','-f',join(outDir,'narration.txt'),'-w',join(outDir,'narration.wav')]);
const final=join(outDir,'ant-documentary-real-media-with-audio.mp4');
run('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',silent,'-i',join(outDir,'narration.wav'),'-c:v','copy','-c:a','aac','-b:a','160k','-shortest','-movflags','+faststart',final]);
provenance.finalVideo=basename(final); provenance.generatedAt=new Date().toISOString();
writeFileSync(join(outDir,'scene-provenance.json'),JSON.stringify(provenance,null,2),'utf8');
writeFileSync(join(outDir,'PROVENANCE.md'),[
'# Ant documentary real-media benchmark',
'',
'كل مشاهد الفيديو الواقعية في هذا الـbenchmark مأخوذة من ملفات Wikimedia Commons المسجلة في manifest تحت CC BY 2.0، مع حفظ المصدر والمؤلف والترخيص وSHA-256.',
'',
...assets.map(a=>`- ${a.filename} — ${a.author} — ${a.license}\n  Source: ${a.sourcePage}\n  SHA-256: ${a.sha256}`),
'',
'## Scientific evidence',
'- Hölldobler 1978: https://doi.org/10.1016/S0065-3454(08)60132-1',
'- Masoni et al. 2021: https://doi.org/10.1038/s41598-021-84925-z',
'',
'## Quranic layer',
'- Surah An-Naml 27:18: https://quran.com/27:18',
'- لا توجد تلاوة قرآنية مولدة في هذا النموذج.'
].join('\n'),'utf8');

console.log(`Rendered ${final}`);
