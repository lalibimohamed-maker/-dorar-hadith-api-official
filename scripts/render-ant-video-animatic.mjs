import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = 'dist/video-prototypes/ant-communication-27-18';
mkdirSync(outDir, { recursive: true });

const ass = String.raw`[Script Info]\nScriptType: v4.00+\nPlayResX: 1280\nPlayResY: 720\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Arabic,DejaVu Sans,34,&H00FFFFFF,&H00FFFFFF,&H00101010,&H60000000,0,0,100,2,1,2,60,60,55,1\nStyle: Small,DejaVu Sans,23,&H00D8E8FF,&H00D8E8FF,&H00101010,&H60000000,0,0,1,2,1,2,60,60,22,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:00.00,0:00:06.00,Arabic,,60,60,55,,تواصل النمل: من الملاحظة العلمية إلى الشاهد القرآني\nDialogue: 0,0:00:00.00,0:00:06.00,Small,,60,60,22,,Prototype • Evidence-first • original animated scenes\nDialogue: 0,0:00:06.00,0:00:12.00,Arabic,,60,60,55,,قنوات متعددة: كيميائية ولمسية واهتزازية\nDialogue: 0,0:00:06.00,0:00:12.00,Small,,60,60,22,,Scientific Reports 2021 • ant communication literature\nDialogue: 0,0:00:12.00,0:00:18.00,Arabic,,60,60,55,,بعض الإشارات الاهتزازية تختلف باختلاف السياق السلوكي\nDialogue: 0,0:00:12.00,0:00:18.00,Small,,60,60,22,,Observation class • not human-speech equivalence\nDialogue: 0,0:00:18.00,0:00:24.00,Arabic,,60,60,55,,﴿حَتَّىٰٓ إِذَآ أَتَوْا۟ عَلَىٰ وَادِ ٱلنَّمْلِ قَالَتْ نَمْلَةٌۭ يَـٰٓأَيُّهَا ٱلنَّمْلُ ٱدْخُلُوا۟ مَسَـٰكِنَكُمْ لَا يَحْطِمَنَّكُمْ سُلَيْمَـٰنُ وَجُنُودُهُۥ وَهُمْ لَا يَشْعُرُونَ﴾\nDialogue: 0,0:18.00,0:24.00,Small,,60,60,22,,القرآن الكريم • النمل 27:18 • Arabic source layer\nDialogue: 0,0:24.00,0:30.00,Arabic,,60,60,55,,الصلات التفسيرية تُعرض بحذر ولا تتحول تلقائيًا إلى دعوى إعجاز\nDialogue: 0,0:24.00,0:30.00,Small,,60,60,22,,Next: licensed recitation • word alignment • multilingual • 48K-class mastering\n`;
writeFileSync(join(outDir, 'captions.ass'), ass, 'utf8');

const filters = [
  'drawbox=x=0:y=0:w=1280:h=720:color=0x07111f:t=fill',
  'drawbox=x=0:y=420:w=1280:h=300:color=0x0d1a24:t=fill',
  'drawbox=x=80:y=505:w=1120:h=5:color=0x5ea7e8@0.65:t=fill',
  'drawbox=x=140:y=325:w=190:h=120:color=0x26394a@0.92:t=fill',
  'drawbox=x=360:y=285:w=200:h=160:color=0x26394a@0.92:t=fill',
  'drawbox=x=590:y=340:w=190:h=105:color=0x26394a@0.92:t=fill',
  'drawbox=x=825:y=270:w=220:h=175:color=0x26394a@0.92:t=fill',
  'drawbox=x=300:y=395:w=100:h=8:color=0x425e72@0.9:t=fill',
  'drawbox=x=555:y=355:w=70:h=8:color=0x425e72@0.9:t=fill',
  'drawbox=x=775:y=395:w=70:h=8:color=0x425e72@0.9:t=fill',
  'drawbox=x=120+260*sin(0.35*t):y=470-18*sin(2*t):w=48:h=12:color=0xe2aa4c@1:t=fill',
  'drawbox=x=165+260*sin(0.35*t):y=470-18*sin(2*t):w=13:h=13:color=0xe2aa4c@1:t=fill',
  'drawbox=x=126+260*sin(0.35*t):y=484-18*sin(2*t):w=9:h=28:color=0xe2aa4c@1:t=fill',
  'drawbox=x=154+260*sin(0.35*t):y=484-18*sin(2*t):w=9:h=28:color=0xe2aa4c@1:t=fill',
  'drawbox=x=680-260*sin(0.28*t):y=455-22*sin(1.5*t):w=48:h=12:color=0xd8903f@1:t=fill',
  'drawbox=x=725-260*sin(0.28*t):y=455-22*sin(1.5*t):w=13:h=13:color=0xd8903f@1:t=fill',
  'drawbox=x=686-260*sin(0.28*t):y=469-22*sin(1.5*t):w=9:h=28:color=0xd8903f@1:t=fill',
  'drawbox=x=714-260*sin(0.28*t):y=469-22*sin(1.5*t):w=9:h=28:color=0xd8903f@1:t=fill',
  'drawbox=x=905+35*sin(1.1*t):y=210+24*sin(0.8*t):w=48:h=12:color=0xf0bf62@1:t=fill',
  'drawbox=x=950+35*sin(1.1*t):y=210+24*sin(0.8*t):w=13:h=13:color=0xf0bf62@1:t=fill',
  'drawbox=x=180+140*sin(0.7*t):y=455:w=18:h=4:color=0x71d6b5@0.8:t=fill',
  'drawbox=x=440+120*sin(0.9*t):y=475:w=18:h=4:color=0x71d6b5@0.8:t=fill',
  'drawbox=x=820+160*sin(0.6*t):y=470:w=18:h=4:color=0x71d6b5@0.8:t=fill',
  'drawbox=x=510:y=185+18*sin(4*t):w=120:h=4:color=0x7cc6ff@0.8:t=fill',
  'drawbox=x=535:y=170+24*sin(4*t):w=70:h=4:color=0x7cc6ff@0.55:t=fill',
  'drawbox=x=555:y=155+30*sin(4*t):w=30:h=4:color=0x7cc6ff@0.35:t=fill',
  'drawbox=x=75:y=70:w=1130:h=95:color=0x0b2135@0.93:t=fill',
  'drawbox=x=75:y=70:w=1130:h=3:color=0xe4b252@0.9:t=fill',
  `subtitles=${join(outDir, 'captions.ass')}`
].join(',');

const output = join(outDir, 'ant-communication-27-18-animatic.mp4');
const narrationText = join(outDir, 'narration.txt');
const narration = 'هذا نموذج أولي لفيديو موسوعي عن تواصل النمل. تعرض الدراسات العلمية قنوات متعددة للتواصل عند النمل، ومنها الإشارات الكيميائية واللمسية والاهتزازية. وتوجد أبحاث تصف تغير بعض الإشارات الاهتزازية بحسب السياق السلوكي. ثم نعرض الشاهد القرآني في سورة النمل، الآية الثامنة عشرة. هنا تلتزم الموسوعة بالفصل بين الملاحظة العلمية وبين الصلة التفسيرية، فلا تحولها آليًا إلى دعوى إعجاز علمي.';
writeFileSync(narrationText, narration, 'utf8');
execFileSync('espeak-ng', ['-v', 'ar', '-s', '138', '-f', narrationText, '-w', join(outDir, 'narration.wav')], { stdio: 'inherit' });

execFileSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'error',
  '-f', 'lavfi', '-i', 'color=c=0x07111f:s=1280x720:r=30:d=30',
  '-f', 'lavfi', '-i', 'aevalsrc=0.008*sin(2*PI*110*t):s=48000:d=30',
  '-i', join(outDir, 'narration.wav'),
  '-vf', filters,
  '-filter_complex', '[1:a][2:a]amix=inputs=2:duration=longest:dropout_transition=2[aout]',
  '-map', '0:v:0', '-map', '[aout]',
  '-t', '30',
  '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '128k',
  output
], { stdio: 'inherit' });

writeFileSync(join(outDir, 'README.txt'), [
  'First Din Allah Encyclopedia evidence-driven ant video prototype.',
  'Revision: 30-second deterministic animated documentary prototype with free/local Arabic explanatory narration.',
  'The visuals are original procedural/vector animation; no third-party footage is embedded.',
  'The Quranic Arabic is displayed from the verified source layer; this prototype intentionally does not synthesize or embed Quranic recitation.',
  'Scientific evidence: Scientific Reports 2021 on ant stridulatory signalling and behavioural context; Animal Behaviour review on acoustic signalling in ants.',
  'The scientific narration is separate from the Quranic text and does not claim human-language equivalence or automatic scientific miracle proof.',
  'Next production stage: rights-cleared real footage or original generated scenes, licensed recitation, word alignment, multilingual translation, color fidelity, VSR, and 48K-class mastering.'
].join('\n'), 'utf8');

console.log(`Rendered ${output}`);
