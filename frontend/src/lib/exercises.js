/**
 * Exercise display library.
 *
 * The BACKEND owns programming data (equipment, safety, sets/reps) — see
 * backend/src/services/exercises.js. This file owns everything the user sees:
 * bilingual names, form cues, and which 3D animation to play. The two are
 * joined by `id`; an id here that doesn't exist there (or vice versa) is a bug,
 * and `assertCatalogParity()` below reports it in development.
 *
 * `gifUrl` is null everywhere. When you have licensed demo GIFs, paste the URL
 * in and `ExerciseDemo` renders the image instead of the 3D canvas — no other
 * change needed.
 */

const e = (id, en, am, threeJsAnim, cuesEn, cuesAm, gifUrl = null) => [
  id,
  { id, name: { en, am }, threeJsAnim, cues: { en: cuesEn, am: cuesAm }, gifUrl },
];

export const EXERCISE_DISPLAY = Object.fromEntries([
  // ── Chest ──────────────────────────────────────────────────────────────────
  e('bench_press', 'Barbell Bench Press', 'ባርቤል ቤንች ፕሬስ', 'benchPress',
    ['Pull your shoulder blades back and down', 'Lower the bar to mid-chest', 'Drive your feet into the floor'],
    ['ትከሻህን ወደ ኋላ እና ወደ ታች ሰብስብ', 'ባርቤሉን ወደ ደረትህ መሃል አውርድ', 'እግርህን መሬት ላይ ተጫን']),
  e('dumbbell_flyes', 'Dumbbell Flyes', 'ዳምቤል ፍላይ', 'benchPress',
    ['Keep a soft bend in the elbows', 'Open wide until you feel a stretch', 'Squeeze the chest to bring them together'],
    ['ክርንህ ላይ ትንሽ መታጠፍ ይኑር', 'መወጠር እስኪሰማህ ድረስ ክፈት', 'ደረትህን ጨምቀህ አገናኛቸው']),
  e('incline_dumbbell_press', 'Incline Dumbbell Press', 'ኢንክላይን ዳምቤል ፕሬስ', 'benchPress',
    ['Set the bench to about 30°', 'Press up and slightly together', 'Control the lowering — do not drop'],
    ['ወንበሩን በ30 ዲግሪ አካባቢ አድርግ', 'ወደ ላይ እና ትንሽ ወደ መሃል ግፋ', 'ሲወርድ ተቆጣጠር — አትጣለው']),
  e('cable_crossover', 'Cable Crossover', 'ኬብል ክሮስኦቨር', 'benchPress',
    ['Step forward so there is tension at the start', 'Lead with the elbows, not the hands', 'Cross slightly at the front'],
    ['መጀመሪያ ላይ ውጥረት እንዲኖር ወደፊት እርምጃ ውሰድ', 'በክርንህ ምራ እንጂ በእጅህ አይደለም', 'ፊት ለፊት ትንሽ አሻግር']),
  e('push_up', 'Push-up', 'ፑሽ አፕ', 'pushup',
    ['One straight line from head to heels', 'Squeeze your glutes so the hips do not sag', 'Lower until the chest nearly touches'],
    ['ከጭንቅላት እስከ ተረከዝ አንድ ቀጥተኛ መስመር', 'ወገብህ እንዳይወርድ መቀመጫህን ጨምቅ', 'ደረትህ እስኪነካ ድረስ አውርድ']),

  // ── Back ───────────────────────────────────────────────────────────────────
  e('deadlift', 'Barbell Deadlift', 'ባርቤል ዴድሊፍት', 'deadlift',
    ['Bar over the middle of your foot', 'Set your lats and brace hard', 'Hips and chest rise together'],
    ['ባርቤሉ የእግርህ መሃል ላይ ይሁን', 'ጀርባህን አጥብቀህ ያዝ', 'ወገብህና ደረትህ አብረው ይነሱ']),
  e('pull_up', 'Pull-up', 'ፑል አፕ', 'pullup',
    ['Start from a full dead hang', 'Lead with the chest', 'Drive the elbows down to your ribs'],
    ['ሙሉ በሙሉ ተንጠልጥለህ ጀምር', 'በደረትህ ምራ', 'ክርንህን ወደ ጎድንህ አውርድ']),
  e('lat_pulldown', 'Lat Pulldown', 'ላት ፑልዳውን', 'latPulldown',
    ['Chest up, slight lean back', 'Pull the bar to your collarbone', 'Drive the elbows down, do not just pull with arms'],
    ['ደረትህ ወደ ላይ፣ ትንሽ ወደ ኋላ አዘንብል', 'ባሩን ወደ አንገትህ አጥንት ሳብ', 'በክንድህ ብቻ አትሳብ — ክርንህን አውርድ']),
  e('barbell_row', 'Barbell Row', 'ባርቤል ሮው', 'barbellRow',
    ['Hinge forward to about 45°', 'Row to your lower ribs', 'Do not let your torso bounce up'],
    ['ወደ 45 ዲግሪ አካባቢ ወደፊት አጎንብስ', 'ወደ ታችኛው ጎድንህ ሳብ', 'ሰውነትህ ወደ ላይ እንዳይወራጭ']),
  e('seated_cable_row', 'Seated Cable Row', 'ተቀምጦ ኬብል ሮው', 'barbellRow',
    ['Sit tall, chest proud', 'Pull to your belly button', 'Let the shoulder blades come together'],
    ['ቀጥ ብለህ ተቀመጥ፣ ደረትህን ክፈት', 'ወደ እምብርትህ ሳብ', 'ትከሻዎችህ ይገናኙ']),
  e('single_arm_dumbbell_row', 'Single-arm Dumbbell Row', 'በአንድ እጅ ዳምቤል ሮው', 'barbellRow',
    ['Support yourself on the bench', 'Keep your back flat, not twisted', 'Pull the weight to your hip'],
    ['ወንበሩ ላይ ተደገፍ', 'ጀርባህ ጠፍጣፋ ይሁን፣ አይጣመም', 'ክብደቱን ወደ ወገብህ ሳብ']),

  // ── Shoulders ──────────────────────────────────────────────────────────────
  e('overhead_press', 'Overhead Barbell Press', 'ኦቨርሄድ ባርቤል ፕሬስ', 'overheadPress',
    ['Squeeze your glutes to protect your back', 'Press the bar past your face', 'Finish with your head through the window'],
    ['ጀርባህን ለመጠበቅ መቀመጫህን ጨምቅ', 'ባሩን ከፊትህ አልፎ ግፋ', 'ጭንቅላትህ በክንዶችህ መሃል ይውጣ']),
  e('dumbbell_lateral_raise', 'Lateral Raise', 'ላተራል ሬይዝ', 'lateralRaise',
    ['Lead with the elbows', 'Stop at shoulder height', 'Light weight, strict form — this is not a swing'],
    ['በክርንህ ምራ', 'ትከሻህ ደረጃ ላይ አቁም', 'ቀላል ክብደት፣ ጥብቅ አሠራር — ማወዛወዝ አይደለም']),
  e('front_raise', 'Front Raise', 'ፍሮንት ሬይዝ', 'lateralRaise',
    ['Raise to eye level, no higher', 'Keep your torso still', 'Lower slowly under control'],
    ['እስከ ዓይንህ ደረጃ አንሳ፣ ከዚያ አትብለጥ', 'ሰውነትህ ሳይንቀሳቀስ ይቁም', 'በቀስታ ተቆጣጥረህ አውርድ']),
  e('face_pull', 'Face Pull', 'ፌስ ፑል', 'latPulldown',
    ['Pull the rope towards your eyes', 'Rotate the hands outward at the end', 'The best insurance for pressing shoulders'],
    ['ገመዱን ወደ ዓይኖችህ ሳብ', 'መጨረሻ ላይ እጆችህን ወደ ውጭ አሽከርክር', 'ለትከሻ ጤና ምርጡ መከላከያ']),
  e('arnold_press', 'Arnold Press', 'አርኖልድ ፕሬስ', 'overheadPress',
    ['Start with palms facing you', 'Rotate as you press up', 'Reverse the rotation coming down'],
    ['መዳፍህ ወደ አንተ ዞሮ ጀምር', 'ወደ ላይ ስትገፋ አሽከርክር', 'ስትወርድ አዙሪቱን መልስ']),

  // ── Biceps ─────────────────────────────────────────────────────────────────
  e('barbell_curl', 'Barbell Curl', 'ባርቤል ከርል', 'barbellCurl',
    ['Pin your elbows to your sides', 'No swinging — if you swing, go lighter', 'Squeeze at the top'],
    ['ክርንህን ጎንህ ላይ አጣብቅ', 'አታወዛውዝ — ካወዛወዝክ ክብደቱን ቀንስ', 'ላይ ላይ ጨምቅ']),
  e('hammer_curl', 'Hammer Curl', 'ሐመር ከርል', 'barbellCurl',
    ['Palms face each other throughout', 'Elbows stay still', 'Control the way down'],
    ['መዳፎችህ እርስ በርስ ተያይተው ይቆዩ', 'ክርንህ ሳይንቀሳቀስ ይቁም', 'ሲወርድ ተቆጣጠር']),
  e('concentration_curl', 'Concentration Curl', 'ኮንሰንትሬሽን ከርል', 'barbellCurl',
    ['Brace your elbow against your inner thigh', 'Curl slowly', 'Full stretch at the bottom'],
    ['ክርንህን በጭንህ ውስጠኛ ክፍል ደግፍ', 'በቀስታ አጠፍ', 'ታች ላይ ሙሉ በሙሉ ዘርጋ']),
  e('preacher_curl', 'Preacher Curl', 'ፕሪቸር ከርል', 'barbellCurl',
    ['Chest against the pad', 'Do not fully lock out at the bottom', 'Slow, controlled negatives'],
    ['ደረትህ ትራሱ ላይ ይደገፍ', 'ታች ላይ ሙሉ በሙሉ አትዘርጋ', 'ቀስ ያለ፣ የተቆጣጠረ መውረድ']),

  // ── Triceps ────────────────────────────────────────────────────────────────
  e('close_grip_bench', 'Close-grip Bench Press', 'ክሎዝ ግሪፕ ቤንች ፕሬስ', 'benchPress',
    ['Hands about shoulder width', 'Tuck the elbows close to the body', 'Lower to the lower chest'],
    ['እጆችህ በትከሻ ስፋት ያህል', 'ክርንህን ወደ ሰውነትህ አጣብቅ', 'ወደ ታችኛው ደረትህ አውርድ']),
  e('overhead_tricep_extension', 'Overhead Tricep Extension', 'ኦቨርሄድ ትራይሰፕ ኤክስቴንሽን', 'overheadPress',
    ['Keep the elbows pointing forward', 'Lower behind the head slowly', 'Full extension at the top'],
    ['ክርንህ ወደፊት አቅጣጫ ይያዝ', 'ከጭንቅላትህ ጀርባ በቀስታ አውርድ', 'ላይ ላይ ሙሉ በሙሉ ዘርጋ']),
  e('tricep_pushdown', 'Tricep Pushdown', 'ትራይሰፕ ፑሽዳውን', 'barbellCurl',
    ['Elbows locked at your sides', 'Push all the way to straight arms', 'Control back up'],
    ['ክርንህ ጎንህ ላይ ተቆልፎ ይያዝ', 'ክንዶችህ እስኪቀኑ ድረስ ግፋ', 'ወደ ላይ ስትመልስ ተቆጣጠር']),
  e('skull_crusher', 'Skull Crusher', 'ስካል ክራሸር', 'benchPress',
    ['Elbows stay pointing at the ceiling', 'Lower to your forehead', 'Do not flare the elbows out'],
    ['ክርንህ ወደ ጣሪያ አቅጣጫ ይያዝ', 'ወደ ግንባርህ አውርድ', 'ክርንህን ወደ ጎን አትክፈት']),

  // ── Legs ───────────────────────────────────────────────────────────────────
  e('back_squat', 'Barbell Back Squat', 'ባርቤል ባክ ስኩዋት', 'squat',
    ['Brace as if about to take a punch', 'Sit between your hips, not back', 'Drive the floor away'],
    ['ቡጢ ልትመታ እንደሆነ ሆድህን አጥብቅ', 'ወደ ኋላ ሳይሆን በወገብህ መሃል ተቀመጥ', 'መሬቱን ገፍተህ ተነስ']),
  e('romanian_deadlift', 'Romanian Deadlift', 'ሮማኒያን ዴድሊፍት', 'deadlift',
    ['Soft knees, push the hips back', 'Bar stays against your legs', 'Stop when the hamstrings run out'],
    ['ጉልበትህ ትንሽ ታጥፎ፣ ወገብህን ወደ ኋላ ግፋ', 'ባሩ እግርህን ተጣብቆ ይቆይ', 'የጭንህ ጡንቻ ሲወጠር አቁም']),
  e('leg_press', 'Leg Press', 'ሌግ ፕሬስ', 'legPress',
    ['Feet in the middle of the platform', 'Lower until the hips start to tuck', 'Do not lock the knees hard'],
    ['እግርህ የመድረኩ መሃል ላይ', 'ወገብህ መታጠፍ እስኪጀምር አውርድ', 'ጉልበትህን አጥብቀህ አትቆልፍ']),
  e('leg_curl', 'Leg Curl', 'ሌግ ከርል', 'legPress',
    ['Control the negative', 'The hamstrings work harder lowering', 'Do not lift your hips off the pad'],
    ['ሲወርድ ተቆጣጠር', 'የጭን ጡንቻ ሲወርድ የበለጠ ይሠራል', 'ወገብህን ከትራሱ አታንሳ']),
  e('leg_extension', 'Leg Extension', 'ሌግ ኤክስቴንሽን', 'legPress',
    ['Pause briefly at the top', 'Lower slowly', 'Keep your back against the pad'],
    ['ላይ ላይ ትንሽ ቆም በል', 'በቀስታ አውርድ', 'ጀርባህ ትራሱ ላይ ተደግፎ ይቆይ']),
  e('walking_lunge', 'Walking Lunge', 'ዎኪንግ ላንጅ', 'lunge',
    ['Take a long step', 'Back knee toward the floor', 'Drive through the front heel'],
    ['ረጅም እርምጃ ውሰድ', 'የኋላ ጉልበትህ ወደ መሬት ይውረድ', 'በፊተኛው ተረከዝህ ተጫን']),
  e('calf_raise', 'Standing Calf Raise', 'ካልፍ ሬይዝ', 'calfRaise',
    ['Full stretch at the bottom', 'Hard squeeze at the top', 'Pause at both ends'],
    ['ታች ላይ ሙሉ በሙሉ ዘርጋ', 'ላይ ላይ አጥብቀህ ጨምቅ', 'በሁለቱም ጫፍ ቆም በል']),

  // ── Core ───────────────────────────────────────────────────────────────────
  e('plank', 'Plank', 'ፕላንክ', 'plank',
    ['Squeeze glutes and quads', 'Ribs down, do not arch', 'Quality beats duration'],
    ['መቀመጫህንና ጭንህን ጨምቅ', 'ጎድንህ ወደ ታች፣ አትቀስት', 'ከጊዜ ርዝመት ጥራት ይበልጣል']),
  e('cable_crunch', 'Cable Crunch', 'ኬብል ክራንች', 'crunch',
    ['Curl your spine, do not just bend at the hip', 'Pull with the abs, not the arms', 'Exhale as you crunch'],
    ['አከርካሪህን አጠፍ፣ በወገብህ ብቻ አትታጠፍ', 'በሆድህ ሳብ እንጂ በክንድህ አይደለም', 'ስትታጠፍ ተንፍስ']),
  e('hanging_leg_raise', 'Hanging Leg Raise', 'ሃንጊንግ ሌግ ሬይዝ', 'crunch',
    ['No swinging', 'Curl the pelvis up, do not just lift the legs', 'Lower under control'],
    ['አታወዛውዝ', 'ዳሌህን አጠፍ፣ እግርህን ብቻ አታንሳ', 'ተቆጣጥረህ አውርድ']),
  e('ab_wheel_rollout', 'Ab Wheel Rollout', 'አብ ዊል ሮልአውት', 'plank',
    ['Start on your knees', 'Do not let the hips sag', 'Only roll as far as you can control'],
    ['በጉልበትህ ጀምር', 'ወገብህ እንዳይወርድ', 'መቆጣጠር እስከምትችለው ድረስ ብቻ ግፋ']),
  e('russian_twist', 'Russian Twist', 'ራሽያን ትዊስት', 'crunch',
    ['Lean back until you feel the abs engage', 'Rotate from the ribs, not the arms', 'Keep the chest open'],
    ['ሆድህ እስኪሠራ ወደ ኋላ አዘንብል', 'በጎድንህ አሽከርክር እንጂ በክንድህ አይደለም', 'ደረትህ ክፍት ይሁን']),

  // ── Compound ───────────────────────────────────────────────────────────────
  e('power_clean', 'Power Clean', 'ፓወር ክሊን', 'deadlift',
    ['Explode from the floor', 'Keep the bar close to your body', 'Catch with the elbows high'],
    ['ከመሬት በኃይል ተነሳ', 'ባሩ ሰውነትህን ተጠግቶ ይቆይ', 'ክርንህን ከፍ አድርገህ ተቀበል']),
  e('barbell_thruster', 'Barbell Thruster', 'ባርቤል ትረስተር', 'squat',
    ['Squat, then drive straight into the press', 'One continuous movement', 'Breathe at the top'],
    ['ስኩዋት አድርግ፣ ከዚያ በቀጥታ ወደ ፕሬስ ግባ', 'አንድ ተከታታይ እንቅስቃሴ', 'ላይ ላይ ተንፍስ']),

  // ── Conditioning ───────────────────────────────────────────────────────────
  e('jumping_jacks', 'Jumping Jacks', 'ጃምፒንግ ጃክ', 'jack',
    ['Land softly on the balls of your feet', 'Full arm extension overhead', 'Keep a steady rhythm'],
    ['በእግርህ ጣቶች ለስላሳ አረፋፍድ', 'ክንዶችህን ከጭንቅላትህ በላይ ሙሉ ዘርጋ', 'ተመጣጣኝ ምት ጠብቅ']),
  e('high_knees', 'High Knees', 'ሃይ ኒስ', 'run',
    ['Drive the knees to hip height', 'Stay on the balls of your feet', 'Pump the arms'],
    ['ጉልበትህን እስከ ወገብህ ከፍታ አንሳ', 'በእግርህ ጣቶች ላይ ቁም', 'ክንዶችህን አወዛውዝ']),
  e('mountain_climbers', 'Mountain Climbers', 'ማውንቴን ክላይምበርስ', 'climber',
    ['Hips stay low and level', 'Drive the knee to your chest', 'Keep the shoulders over the wrists'],
    ['ወገብህ ዝቅ ብሎና ተስተካክሎ ይቆይ', 'ጉልበትህን ወደ ደረትህ ግፋ', 'ትከሻህ በእጅ አንጓህ ላይ ይሁን']),
  e('burpees', 'Burpees', 'በርፒ', 'burpee',
    ['Chest to the floor', 'Jump to full extension', 'Pace yourself — everyone goes out too fast'],
    ['ደረትህ መሬት ይንካ', 'ሙሉ በሙሉ ዘርግተህ ዝለል', 'ፍጥነትህን አስተካክል — ሁሉም ሰው በጣም ፈጥኖ ይጀምራል']),
  e('jump_rope', 'Jump Rope', 'ገመድ ዝላይ', 'jack',
    ['Small jumps, just off the floor', 'Turn the rope with the wrists', 'Stay light on your feet'],
    ['ትንንሽ ዝላዮች፣ ከመሬት ትንሽ ከፍ ብለህ', 'ገመዱን በእጅ አንጓህ አዙር', 'እግርህ ቀላል ይሁን']),
  e('box_jump', 'Box Jump', 'ቦክስ ጃምፕ', 'squat',
    ['Land softly with bent knees', 'Step down, do not jump down', 'Use a height you are confident with'],
    ['ጉልበትህን አጥፈህ ለስላሳ አረፋፍድ', 'ወርደህ ውረድ፣ ዘልለህ አትውረድ', 'እርግጠኛ የምትሆንበትን ከፍታ ተጠቀም']),
  e('battle_rope', 'Battle Rope', 'ባትል ሮፕ', 'run',
    ['Stay in a quarter squat', 'Drive from the hips', 'Keep the waves even'],
    ['በሩብ ስኩዋት ቁም', 'ከወገብህ ኃይል አምጣ', 'ማዕበሎቹ እኩል ይሁኑ']),
  e('squat_jump', 'Squat Jump', 'ስኩዋት ጃምፕ', 'squat',
    ['Sink to a comfortable depth', 'Explode straight up', 'Absorb the landing softly'],
    ['ወደምትመቸው ጥልቀት ውረድ', 'በኃይል ወደ ላይ ተነሳ', 'ማረፊያውን በለስላሳ ተቀበል']),
  e('sprint_intervals', 'Sprint Intervals', 'የሩጫ ክፍተቶች', 'run',
    ['Build up, do not start flat out', 'Drive the arms', 'Walk fully during the rest'],
    ['ቀስ ብለህ ጨምር፣ ወዲያውኑ አትሮጥ', 'ክንዶችህን አወዛውዝ', 'በእረፍት ጊዜ በደንብ ተራመድ']),
  e('bicycle_crunch', 'Bicycle Crunch', 'ባይሲክል ክራንች', 'crunch',
    ['Opposite elbow to opposite knee', 'Slow and controlled beats fast', 'Do not pull on your neck'],
    ['ተቃራኒ ክርን ወደ ተቃራኒ ጉልበት', 'ከፍጥነት ይልቅ ቀስ ብሎ መቆጣጠር ይሻላል', 'አንገትህን አትሳብ']),
  e('kettlebell_swing', 'Kettlebell Swing', 'ኬትልቤል ስዊንግ', 'bridge',
    ['This is a hinge, not a squat', 'Snap the hips forward', 'The arms are just rope'],
    ['ይህ የወገብ መታጠፍ እንጂ ስኩዋት አይደለም', 'ወገብህን ወደፊት በኃይል ግፋ', 'ክንዶችህ እንደ ገመድ ብቻ ናቸው']),

  // ── Low-impact ─────────────────────────────────────────────────────────────
  e('brisk_walk', 'Brisk Walk', 'ፈጣን የእግር ጉዞ', 'run',
    ['Walk fast enough that talking is a little harder', 'Stand tall, swing the arms', 'Any pace you can sustain is the right pace'],
    ['ማውራት ትንሽ እስኪከብድ ድረስ ፍጠን', 'ቀጥ ብለህ ቁም፣ ክንዶችህን አወዛውዝ', 'ልትቀጥልበት የምትችለው ማንኛውም ፍጥነት ትክክለኛው ነው']),
  e('march_in_place', 'March in Place', 'በቦታ መረማመድ', 'run',
    ['Lift the knees to a comfortable height', 'Swing the opposite arm', 'Keep breathing steadily'],
    ['ጉልበትህን ወደምትመቸው ከፍታ አንሳ', 'ተቃራኒውን ክንድ አወዛውዝ', 'በተረጋጋ ሁኔታ ተንፍስ']),
  e('step_touch', 'Step Touch', 'ስቴፕ ታች', 'jack',
    ['Step wide to one side, then the other', 'Add the arms when you feel steady', 'No jumping needed'],
    ['ወደ አንድ ጎን ሰፋ ብለህ እርምጃ ውሰድ፣ ከዚያ ወደ ሌላው', 'ስትረጋጋ ክንዶችህን ጨምር', 'መዝለል አያስፈልግም']),
  e('standing_knee_lift', 'Standing Knee Lift', 'ቆሞ ጉልበት ማንሳት', 'run',
    ['Hold a chair if you need balance', 'Lift to a comfortable height', 'Tighten the stomach each lift'],
    ['ሚዛን ከፈለግህ ወንበር ያዝ', 'ወደምትመቸው ከፍታ አንሳ', 'በእያንዳንዱ ማንሳት ሆድህን አጥብቅ']),
  e('chair_squat', 'Chair Squat', 'የወንበር ስኩዋት', 'squat',
    ['Sit back until you touch the chair', 'Stand up without using your hands if you can', 'Knees track over the toes'],
    ['ወንበሩን እስክትነካ ወደ ኋላ ተቀመጥ', 'ከቻልክ እጅህን ሳትጠቀም ተነሳ', 'ጉልበትህ ከጣቶችህ በላይ ይሂድ']),
  e('wall_push_up', 'Wall Push-up', 'የግድግዳ ፑሽ አፕ', 'pushup',
    ['Hands on the wall at chest height', 'Step further back to make it harder', 'Body stays in one straight line'],
    ['እጆችህን ግድግዳው ላይ በደረት ከፍታ አድርግ', 'ለማክበድ ወደ ኋላ ራቅ በል', 'ሰውነትህ በአንድ ቀጥተኛ መስመር ይቆይ']),
  e('knee_push_up', 'Knee Push-up', 'በጉልበት ፑሽ አፕ', 'pushup',
    ['Knees down, hips still in line', 'Lower the chest, not just the head', 'Squeeze the stomach throughout'],
    ['ጉልበትህ መሬት ላይ፣ ወገብህ በመስመር ላይ ይቆይ', 'ጭንቅላትህን ብቻ ሳይሆን ደረትህን አውርድ', 'ሆድህን ሁልጊዜ ጨምቅ']),
  e('glute_bridge', 'Glute Bridge', 'ግሉት ብሪጅ', 'bridge',
    ['Push through the heels', 'Squeeze the glutes hard at the top', 'Do not arch the lower back'],
    ['በተረከዝህ ተጫን', 'ላይ ላይ መቀመጫህን አጥብቀህ ጨምቅ', 'ወገብህን አትቀስት']),
  e('bird_dog', 'Bird Dog', 'በርድ ዶግ', 'plank',
    ['Extend the opposite arm and leg', 'Move slowly — balance is the point', 'Keep the hips level'],
    ['ተቃራኒ ክንድና እግር ዘርጋ', 'በቀስታ ተንቀሳቀስ — ዓላማው ሚዛን ነው', 'ወገብህ ተስተካክሎ ይቆይ']),
  e('dead_bug', 'Dead Bug', 'ዴድ ባግ', 'crunch',
    ['Press the lower back into the floor', 'Lower the opposite arm and leg', 'Breathe out as you extend'],
    ['ወገብህን መሬት ላይ ተጫን', 'ተቃራኒ ክንድና እግር አውርድ', 'ስትዘረጋ ተንፍስ']),
  e('seated_band_row', 'Seated Band Row', 'ተቀምጦ የባንድ ሮው', 'barbellRow',
    ['Sit tall with legs extended', 'Pull the band to your waist', 'Squeeze the shoulder blades'],
    ['ቀጥ ብለህ ተቀመጥ፣ እግርህን ዘርጋ', 'ባንዱን ወደ ወገብህ ሳብ', 'ትከሻዎችህን ጨምቅ']),
  e('band_chest_press', 'Band Chest Press', 'የባንድ ቼስት ፕሬስ', 'benchPress',
    ['Anchor the band behind you', 'Press forward at chest height', 'Control the return'],
    ['ባንዱን ከጀርባህ አስር', 'በደረት ከፍታ ወደፊት ግፋ', 'ሲመለስ ተቆጣጠር']),
  e('band_lateral_raise', 'Band Lateral Raise', 'የባንድ ላተራል ሬይዝ', 'lateralRaise',
    ['Stand on the band', 'Raise to shoulder height', 'Slow on the way down'],
    ['ባንዱ ላይ ቁም', 'እስከ ትከሻ ከፍታ አንሳ', 'ስትወርድ ቀስ በል']),
]);

/** Display metadata for an id, with a safe fallback for unknown ids. */
export function getDisplay(id) {
  return (
    EXERCISE_DISPLAY[id] ?? {
      id,
      name: { en: id.replace(/_/g, ' '), am: id.replace(/_/g, ' ') },
      threeJsAnim: 'squat',
      cues: { en: [], am: [] },
      gifUrl: null,
    }
  );
}

/**
 * Dev-only parity check between this file and the backend catalog.
 * Catches the "added an exercise on one side only" bug, which would otherwise
 * surface as an un-named exercise in someone's workout.
 */
export function assertCatalogParity(backendExercises) {
  if (!import.meta.env.DEV || !Array.isArray(backendExercises)) return;
  const backendIds = new Set(backendExercises.map((x) => x.id));
  const displayIds = new Set(Object.keys(EXERCISE_DISPLAY));

  const missingDisplay = [...backendIds].filter((id) => !displayIds.has(id));
  const orphanDisplay = [...displayIds].filter((id) => !backendIds.has(id));

  if (missingDisplay.length) console.warn('[exercises] no display data for:', missingDisplay);
  if (orphanDisplay.length) console.warn('[exercises] display data with no backend entry:', orphanDisplay);
  if (!missingDisplay.length && !orphanDisplay.length) {
    console.info(`[exercises] ✓ ${backendIds.size} exercises, catalogs in sync`);
  }
}
