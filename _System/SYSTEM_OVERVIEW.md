# Lady E Luck — Multi-Agent Content System
## System Overview & Architecture

---

## HOW IT WORKS

Every morning at 6AM, a master orchestrator kicks off a 7-agent pipeline.
Each agent does one job, saves its output as a JSON file, then the next agent picks it up.
By the time you wake up, a full day's content is organized and ready in:

```
C:\Users\iamsa\Downloads\Content For The Day\YYYY-MM-DD\
```

---

## THE 7 AGENTS

```
AGENT 1: THEME SCOUT
  ↓ Searches social media trends, checks for special days, picks the day theme
  ↓ Saves: theme_brief.json

AGENT 2: STORYLINE GENERATOR
  ↓ Takes the theme and builds the full day story arc, character assignments,
  ↓ vibe, and a content plan for every promo (bonuses, wheel, referrals, etc.)
  ↓ Saves: storyline.json

AGENT 3: TIMING OPTIMIZER
  ↓ Analyzes when Lady E Luck's audience is most active based on day/time patterns
  ↓ Assigns each content piece to its best posting window
  ↓ Saves: schedule.json

AGENT 4: PROMPT ENGINEER
  ↓ Writes detailed Higgsfield image/video prompts and ElevenLabs audio prompts
  ↓ for every asset in the content plan, matched to the day's vibe
  ↓ Saves: prompts.json

AGENT 5: MEDIA GENERATOR
  ↓ Calls Higgsfield (images, reels, music video) and ElevenLabs (voices, song)
  ↓ Downloads all generated files
  ↓ Saves: media files + media_log.json

AGENT 6: CONTENT ORGANIZER
  ↓ Creates today's dated folder in Downloads\Content For The Day\
  ↓ Sorts files into: /images/ /videos/ /audio/ /data/
  ↓ Saves: organized folder structure

AGENT 7: CAPTION WRITER
  ↓ Writes a platform-specific caption for every media file
  ↓ Saves each caption as [filename].txt right next to the media file
  ↓ Also saves a master posting_schedule.txt with the full day plan
```

---

## THEME PRIORITY ORDER (Agent 1)

```
1. TRENDING NOW — Is there a hot topic on social media RIGHT NOW with high engagement?
   (e.g., World Cup, Super Bowl, viral moment, major news)
   → If YES and relevant to gaming/entertainment: use it

2. SPECIAL DAY — Is today a recognized holiday or observance?
   (e.g., July 4th, New Year's, Mother's Day, Valentine's Day, Halloween, etc.)
   → If YES: use the holiday theme

3. DAY-OF-WEEK THEME — No trend, no holiday?
   Monday → "Monday Madness" (fresh start, big bonuses)
   Tuesday → "Double Down Tuesday"
   Wednesday → "Wild Card Wednesday"
   Thursday → "Throwback Thursday Lucky Moments"
   Friday → "Fortune Friday" (weekend kickoff)
   Saturday → "Stack Saturday" (biggest play day)
   Sunday → "Sunday Funday Finals"
```

---

## PROMOTIONAL CONTENT TYPES (always included)

Every day's content plan must include at least one post for each:

| Type | What It Is |
|------|-----------|
| New Player Bonus | Welcome offer for first-time players — show the value |
| Daily Bonus Wheel | Remind players to spin their daily wheel — urgency, FOMO |
| Referral Code | Promote sharing — give friends a code, both get rewarded |
| Daily Bonus | Remind active players about their daily reward |
| Today's Special Bonus | The deal unique to today — tied to the day's theme |

---

## OUTPUT FOLDER STRUCTURE

```
C:\Users\iamsa\Downloads\
└── Content For The Day\
    └── 2026-07-01\
        ├── data\
        │   ├── theme_brief.json
        │   ├── storyline.json
        │   ├── schedule.json
        │   ├── prompts.json
        │   ├── media_log.json
        │   └── posting_schedule.txt  ← master posting plan for the day
        ├── images\
        │   ├── 01_morning_launch.png
        │   ├── 01_morning_launch.txt  ← caption
        │   ├── 02_new_player_bonus.png
        │   ├── 02_new_player_bonus.txt
        │   └── ... (one .txt per image)
        ├── videos\
        │   ├── 01_launch_reel.mp4
        │   ├── 01_launch_reel.txt
        │   └── ...
        └── audio\
            ├── 01_song_of_the_day.mp3
            ├── 01_song_of_the_day.txt
            └── ...
```

---

## WORLD CUP MODE

When World Cup is detected as the trending topic, the following overrides apply:

- Theme: "SCORE BIG AT LADY E LUCK"
- Deals branded as: Golden Boot Jackpot, Hat Trick Bonus, Penalty Kick Free Spin, Halftime Reload
- Characters: Lady E in a referee-inspired gold-trim look; Lucky Lou in a jersey with his slot sticker fishing hat
- Story arc: Match day energy — morning kickoff → halftime deals → final whistle jackpot
- Song of day: High-energy anthem feel, stadium crowd samples
- Colors: Keep Lady E Luck green/gold but add stadium energy (floodlights, pitch green)

---

## FILES IN THIS SYSTEM

```
_System/
  SYSTEM_OVERVIEW.md       ← This file. Full architecture reference.

_Agents/
  01_Theme_Agent.md        ← Theme Scout prompt
  02_Storyline_Agent.md    ← Storyline Generator prompt
  03_Timing_Agent.md       ← Timing Optimizer prompt
  04_Prompt_Agent.md       ← Prompt Engineer prompt
  05_Media_Agent.md        ← Media Generator prompt
  06_Organizer_Agent.md    ← Content Organizer prompt
  07_Caption_Agent.md      ← Caption Writer prompt
```

---

*Lady E Luck Content Intelligence System — v1.0 | July 2026*
