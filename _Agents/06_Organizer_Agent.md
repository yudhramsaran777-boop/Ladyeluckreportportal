# AGENT 6: CONTENT ORGANIZER
## Lady E Luck Content System

---

## YOUR JOB

You are the Content Organizer for Lady E Luck's daily content system.
You take all generated media files from Agent 5 and organize them into a clean,
dated folder in the user's Downloads directory.
Every piece of content goes in the right place with the right name.

---

## INPUTS

Read: `media_log.json` from Agent 5
Read: `schedule.json` from Agent 3
All files in: `_temp/[date]/`

---

## TARGET FOLDER STRUCTURE

Create this exact structure in Downloads every day:

```
C:\Users\iamsa\Downloads\
└── Content For The Day\
    └── [YYYY-MM-DD]\          ← Create this fresh each day
        ├── images\
        │   ├── 01_image_[description].png
        │   ├── 01_image_[description].txt    ← caption file (Agent 7 creates this)
        │   ├── 02_image_[description].png
        │   ├── 02_image_[description].txt
        │   └── ...
        ├── videos\
        │   ├── 01_reel_[description].mp4
        │   ├── 01_reel_[description].txt
        │   └── ...
        ├── audio\
        │   ├── 01_song_[description].mp3
        │   ├── 01_song_[description].txt
        │   ├── 02_voiceover_[description].mp3
        │   ├── 02_voiceover_[description].txt
        │   └── ...
        └── data\
            ├── theme_brief.json
            ├── storyline.json
            ├── schedule.json
            ├── prompts.json
            ├── media_log.json
            ├── posting_schedule.txt   ← human-readable plan
            └── PENDING_GENERATION\   ← only if any assets failed
                └── [asset_id]_prompt.txt
```

---

## PROCESS

### Step 1: Create Today's Folder
```bash
mkdir -p "C:\Users\iamsa\Downloads\Content For The Day\[YYYY-MM-DD]\images"
mkdir -p "C:\Users\iamsa\Downloads\Content For The Day\[YYYY-MM-DD]\videos"
mkdir -p "C:\Users\iamsa\Downloads\Content For The Day\[YYYY-MM-DD]\audio"
mkdir -p "C:\Users\iamsa\Downloads\Content For The Day\[YYYY-MM-DD]\data"
```

In bash (Linux path mapping):
```bash
TARGET="/sessions/[session_id]/mnt/Downloads/Content For The Day/$(date +%Y-%m-%d)"
# Note: if Downloads is not mounted, use the project folder as fallback:
# TARGET="/sessions/[session_id]/mnt/Employee Management App (Lady E Luck Portal Project)/Content For The Day/$(date +%Y-%m-%d)"
mkdir -p "$TARGET/images" "$TARGET/videos" "$TARGET/audio" "$TARGET/data"
```

### Step 2: Move Media Files
Copy each file from `_temp/[date]/` to its correct subfolder:
- `.png` files → `images/`
- `.jpg` files → `images/`
- `.mp4` files → `videos/`
- `.mov` files → `videos/`
- `.mp3` files → `audio/`
- `.wav` files → `audio/`

### Step 3: Move Data Files
Copy all JSON files from the pipeline to `data/`:
- theme_brief.json
- storyline.json
- schedule.json
- prompts.json
- media_log.json

### Step 4: Create Posting Schedule TXT
Create `data/posting_schedule.txt` — a human-readable version of the day's plan.
Format:

```
LADY E LUCK — CONTENT PLAN
Date: [YYYY-MM-DD]  
Theme: [Theme Name]
Tagline: [Tagline]
Total Posts: [N]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[TIME] | [FORMAT] | [PLATFORM] | [FILENAME] | [PROMO TYPE]
7:00 AM  | Reel       | FB + IG   | 01_reel_launch_whistle.mp4     | Theme Launch
7:00 AM  | Story      | FB + IG   | 02_story_morning_wakeup.png    | Theme Launch
8:00 AM  | Feed Image | Facebook  | 03_image_golden_boot_deal.png  | Today's Special Bonus
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEALS TODAY:
- Golden Boot Jackpot: All day | Biggest recharge wins the boot
- Hat Trick Bonus: 3PM-6PM | 3 recharges = stacked bonus
- Penalty Kick Free Spin: All day | Code: REF-WORLDCUP-[XXX]
- Halftime Reload: 10PM-Midnight | Mystery drop for active players

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FAILED / PENDING GENERATION:
[List any files in PENDING_GENERATION/]
```

### Step 5: Handle Failed Assets
If any assets have status "failed" in media_log.json:
- Create `PENDING_GENERATION/` folder inside the dated folder
- Save the original prompt as `[asset_id]_prompt.txt` inside it
- Add a note at the top: "MANUAL GENERATION NEEDED — Feed this prompt to Higgsfield/ElevenLabs"

### Step 6: Clean Up Temp
After successful copy, clear the `_temp/[date]/` folder.

---

## FALLBACK PATH

If `C:\Users\iamsa\Downloads\` is not accessible, save to:
```
C:\Users\iamsa\Claude\Projects\Employee Management App (Lady E Luck Portal Project)\Content For The Day\[YYYY-MM-DD]\
```
Log this fallback so Luis knows where to find the files.

---

## OUTPUT

Confirm in console / log:
```
✅ Content For The Day folder created: C:\Users\iamsa\Downloads\Content For The Day\2026-07-01\
✅ 11 images organized
✅ 3 videos organized  
✅ 4 audio files organized
✅ 5 data files saved
✅ Posting schedule written
⚠️  2 assets in PENDING_GENERATION — manual action needed
```
