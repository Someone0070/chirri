# Chirri Social Media Strategy
## Short-Form Video & Developer Marketing Playbook

*Last updated: March 2026*

---

## 1. Platform Strategy

### TikTok
- **Format:** Screen recordings with voiceover, terminal demos, "storytime" talking head, relatable dev skits
- **Optimal length:** 30-90 seconds (sweet spot: 45-60s)
- **Posting frequency:** 4-5x/week minimum. TikTok rewards volume.
- **Best times for devs:** Tue-Thu 10-11 AM EST, Mon/Wed 7-8 PM EST (lunch break scrolling + evening wind-down)
- **Why it matters:** TikTok's algorithm is discovery-first. A 0-follower account can hit 100K views if the content hooks. B2B SaaS brands like tl;dv, Semrush, and Shopify have proven the model. Dev content (#techtok, #coding) has massive organic reach.
- **What works:** Quick "did you know" explainers, dramatic reveals ("this API just broke everything"), relatable dev humor, screen recordings with punchy narration
- **What doesn't:** Polished corporate videos, long intros, anything that looks like an ad

### X (Twitter)
- **Format:** Text threads, screen recordings (GIFs/video clips), quote-tweet commentary on API news, memes
- **Optimal length:** Videos 15-45 seconds. Threads 3-7 tweets.
- **Posting frequency:** 2-3 tweets/day, 2-3 threads/week
- **Best times for devs:** Weekdays 9-11 AM EST, Tue-Thu peak
- **Why it matters:** Developer Twitter is where opinions spread. API drama, hot takes, and "build in public" content gets massive engagement. Theo (@t3dotgg), levelsio, and ThePrimeagen built audiences here through strong opinions + real work.
- **What works:** Real-time commentary on API changes/outages, data-backed observations, build-in-public updates with numbers, controversial (but defensible) takes
- **What doesn't:** Corporate announcements, press-release language, engagement bait without substance

### YouTube Shorts
- **Format:** Fireship-style fast explainers, terminal demos with narration, "X in 60 seconds" format
- **Optimal length:** 30-60 seconds
- **Posting frequency:** 3-4x/week
- **Best times for devs:** Weekdays 12-2 PM EST, Sat 10 AM EST
- **Why it matters:** YouTube Shorts feed into long-form discovery. Shorts viewers become subscribers who watch longer content. Fireship's "100 Seconds of Code" proved the format -- 200+ episodes, binge-friendly, evergreen.
- **What works:** Dense information delivery, custom motion graphics over screen recordings, series formats ("API Change of the Week"), dry humor
- **What doesn't:** Talking head without visuals, recycled TikToks without reformatting

### Instagram Reels
- **Format:** Polished screen recordings, text-overlay clips, carousels for educational content
- **Optimal length:** 15-30 seconds (shorter than TikTok)
- **Posting frequency:** 3x/week
- **Best times for devs:** Weekdays 11 AM-1 PM EST, Wed/Thu peak
- **Why it matters:** Lower priority for pure dev tools but good for brand awareness. Cross-post from TikTok with minor adjustments. Reaches dev-adjacent audience (designers, PMs, founders).
- **What works:** Visually clean screen recordings, text-heavy educational clips, before/after comparisons
- **What doesn't:** Raw terminal footage without polish, long-form content

### Platform Priority (for Chirri)
1. **X (Twitter)** -- fastest feedback loop, API drama content native here, where devs already discuss tools
2. **TikTok** -- highest growth potential, discovery algorithm favors new accounts
3. **YouTube Shorts** -- evergreen value, builds long-form funnel
4. **Instagram Reels** -- cross-post from TikTok, lowest effort

---

## 2. Content Pillars + 20 Video Ideas

### Pillar 1: "API Drama" (35% of content)
*Breaking changes, outages, price hikes caught by Chirri's diff engine*

1. **"Stripe just quietly deprecated this endpoint"** -- Screen recording of Chirri diff showing the change. Hook: "If you're using Stripe's /v1/charges endpoint, stop what you're doing."
2. **"GitHub's API rate limits changed overnight"** -- Terminal showing the diff. Hook: "GitHub changed something at 2 AM and didn't tell anyone."
3. **"This API price hike is going to break indie projects"** -- Talking head + pricing comparison. Hook: "[Service] just 10x'd their API pricing. Here's who gets hurt."
4. **"3 APIs that broke this week"** -- Weekly digest format. Hook: "Your code might be broken and you don't know it yet."
5. **"I built a bot that watches 100 APIs for changes"** -- Origin story. Hook: "I got burned by a silent API change. So I built this."

**Script template:**
```
[0-2s] HOOK: Dramatic statement about the change
[2-8s] CONTEXT: What changed, shown on screen (Chirri diff view)
[8-20s] IMPACT: Who this affects, why it matters
[20-30s] SOLUTION: How Chirri catches this / what to do about it
[30s] CTA: "Follow for weekly API change alerts"
```
**Visual style:** Screen recording of Chirri's diff output, terminal, split-screen before/after

### Pillar 2: "Dev Tool Demos" (25% of content)
*Show Chirri catching real changes in real time*

6. **"Watch Chirri catch a breaking change in real time"** -- Live demo. Hook: "I pointed Chirri at Twilio's docs 3 hours ago. Look what it found."
7. **"Your monitoring tool checks uptime. Mine checks what actually changed."** -- Comparison. Hook: "UptimeRobot says the site is up. But the API response is completely different."
8. **"How to know before your users do"** -- Tutorial. Hook: "Your users found the bug before you did? That's embarrassing."
9. **"I diff'd every major API's terms of service"** -- Experiment. Hook: "I pointed a diff engine at 50 API terms pages. You won't believe what's changing."
10. **"Set up API change alerts in 30 seconds"** -- Speed demo. Hook: "30 seconds. That's how long this takes."

**Script template:**
```
[0-2s] HOOK: Bold claim or surprising finding
[2-15s] DEMO: Screen recording of actual Chirri output
[15-25s] EXPLAIN: Why this matters for the viewer
[25-30s] CTA: "Link in bio" or "Follow for more"
```
**Visual style:** Clean screen recording, terminal with highlighted diffs, split-screen

### Pillar 3: "Educational" (25% of content)
*API best practices, deprecation patterns, web change patterns*

11. **"5 signs your favorite API is about to deprecate"** -- Listicle. Hook: "Your favorite API is about to kill your feature. Here are the warning signs."
12. **"The deprecation pattern every developer should know"** -- Educational. Hook: "Every major API follows this exact deprecation pattern."
13. **"Why you should never trust API docs"** -- Hot take. Hook: "API docs lie. Here's proof."
14. **"How Stripe handles deprecation vs how everyone else does it"** -- Comparison. Hook: "Stripe gives you 2 years notice. Most APIs give you 2 weeks."
15. **"The real cost of not monitoring your dependencies"** -- Story. Hook: "A startup lost $40K because one API changed a date format."

**Script template:**
```
[0-2s] HOOK: Counterintuitive claim or specific story
[2-20s] TEACH: The concept, with visual examples
[20-28s] CONNECT: How this relates to Chirri (subtle)
[28-30s] CTA: Question to drive comments
```
**Visual style:** Slides with code snippets, terminal examples, comparison tables

### Pillar 4: "Founder Journey" (15% of content)
*Building in public, progress updates, honest takes*

16. **"Month 1 revenue: $0. Month 3 revenue: $X. Here's what changed."** -- Transparency. Hook: the specific numbers.
17. **"I cold-emailed 100 CTOs. 3 responded. Here's what they said."** -- Sales story. Hook: the rejection rate.
18. **"Building a dev tool nobody asked for"** -- Self-aware humor. Hook: "Nobody asked for this. I built it anyway."
19. **"Why I quit my job to watch APIs change"** -- Origin. Hook: "My friends think I'm crazy. I monitor websites for a living."
20. **"The feature I spent 2 weeks on that nobody uses"** -- Honest failure. Hook: specific feature name + time wasted.

**Script template:**
```
[0-2s] HOOK: Specific number or surprising admission
[2-20s] STORY: What happened, with real details
[20-28s] LESSON: What you learned
[28-30s] CTA: "What would you have done?"
```
**Visual style:** Talking head (Alex), occasional screen recordings, casual/authentic feel

---

## 3. Posting Schedule

### Weekly Cadence

| Day | Platform | Content Type | Notes |
|-----|----------|-------------|-------|
| Mon | X | API Drama thread | React to weekend changes |
| Mon | TikTok | API Drama video | Same topic as X thread |
| Tue | X | Educational tweet | Quick tip or pattern |
| Tue | YouTube Shorts | Educational | Evergreen explainer |
| Wed | X | Build in public update | Numbers, progress |
| Wed | TikTok | Dev Tool Demo | Show Chirri working |
| Thu | X | Hot take / opinion | Drive engagement |
| Thu | TikTok | Educational | Best practices |
| Thu | Instagram Reels | Cross-post best TikTok | Repurpose top performer |
| Fri | X | "API Changelog Digest" thread | Weekly roundup |
| Fri | TikTok | API Drama or Founder | End-of-week content |
| Fri | YouTube Shorts | "API Change of the Week" | Signature series |

### Total: ~12-15 pieces/week
- X: 5-7 posts (mix of tweets, threads, video clips)
- TikTok: 4 videos
- YouTube Shorts: 2-3 videos
- Instagram Reels: 2-3 cross-posts

### Timing (all EST)
- **X:** 9-10 AM weekdays
- **TikTok:** 11 AM-1 PM or 7-8 PM weekdays
- **YouTube Shorts:** 12-2 PM weekdays
- **Instagram Reels:** 11 AM-1 PM Wed/Thu

---

## 4. AI Video Generation Toolkit

### Tool Evaluation

| Tool | Best For | Pricing | Dev Content? | Automation? | Quality | Verdict |
|------|----------|---------|-------------|-------------|---------|---------|
| **Remotion** | Programmatic video from code | Free (indie/startup), ~$100/mo company | YES -- render code, diffs, terminal output natively | YES -- full API, React-based, scriptable | High (you control every pixel) | **TOP PICK for automated pipeline** |
| **CapCut** | Quick editing + captions | Free basic, $10/mo Pro | Decent -- good for screen recordings | Limited -- manual editing | Good for social | **Best for manual editing** |
| **HeyGen** | AI avatar presenter videos | $24/mo starter, $149/mo business | Mediocre -- avatars don't feel dev-native | API available ($1000/mo) | Polished but uncanny | Skip -- devs will cringe |
| **Synthesia** | AI presenter videos | $18/mo starter, $64/mo creator | Same issue as HeyGen | API on enterprise plans | Similar to HeyGen | Skip -- same problem |
| **D-ID** | Cheap AI avatars | Lower entry than HeyGen | Robotic-looking avatars | API available | Below HeyGen/Synthesia | Skip |
| **Pictory** | Script-to-video | $19/mo (30 videos) | Limited -- stock footage oriented | Partial -- script input | Generic feel | Maybe for text-heavy content |
| **Lumen5** | Blog-to-video | Free tier, ~$30/mo pro | Limited -- stock-oriented | Blog URL input | Corporate feel | Skip |
| **Runway** | AI-generated visuals | Credit-based, ~$15/mo | Creative but not technical | Limited | Impressive but wrong use case | Skip for regular content |
| **Canva AI** | Quick social templates | Free basic, $13/mo pro | Basic screen recording templates | Template-based | Clean but generic | Supplementary only |

### Recommended Stack
1. **Remotion** (core pipeline) -- Programmatic video generation. Feed it diff data, render videos automatically. React-based so any developer can customize templates.
2. **CapCut Free/Pro** (manual editing) -- For talking head videos, adding captions, quick cuts. Alex records, edits in CapCut.
3. **CapCut AI Captions** -- Auto-generate captions for accessibility and engagement (80% of TikTok is watched on mute).

### The $1-3 Per Video Target

**Achievable with Remotion + AWS Lambda:**
- Remotion Lambda rendering cost: ~$0.01-0.05 per video (AWS Lambda charges)
- Template development: one-time cost (build once, reuse forever)
- Total per automated video: **under $0.10** after templates are built
- For manual (Alex-recorded) videos: $0 (just his time + free CapCut)

**What $1-3 gets you:**
- Remotion: Multiple programmatic videos per dollar
- Pictory: ~$0.63/video on Starter plan (30 videos for $19/mo)
- CapCut Pro: ~$0.33/video if making 30 videos/mo ($10/mo)

**Best quality-to-cost ratio:** Remotion (free for startups) + CapCut Free = **$0/month** tooling cost. Just Alex's time.

---

## 5. Content Automation Pipeline

### Architecture: Diff Engine -> Script -> Video

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────┐
│ Chirri Diff  │────▶│ Script Gen   │────▶│ Remotion     │────▶│ Post Queue  │
│ Engine       │     │ (LLM + rules)│     │ Render       │     │ (scheduler) │
│ (hourly)     │     │              │     │              │     │             │
└─────────────┘     └──────────────┘     └──────────────┘     └─────────────┘
      │                                                              │
      │ monitors 100+ APIs                                           │
      │ detects changes                                    TikTok, X, YT, IG
```

### Step-by-Step Pipeline

**1. Detection (already exists)**
- Chirri's diff engine runs hourly on 100+ API docs/endpoints
- When a meaningful change is detected, it generates structured diff data

**2. Script Generation**
- Feed diff data to an LLM (Claude/GPT) with Chirri's copywriting rules
- Template prompt:
  ```
  You are a developer content creator. Given this API change diff:
  {diff_data}

  Write a 30-second video script following these rules:
  - Hook in first 2 seconds (dramatic, specific)
  - No AI slop (no "in today's fast-paced world", no "seamlessly")
  - Developer-native language
  - End with a question or CTA
  - Include visual directions [SHOW: diff screenshot] [SHOW: terminal]
  ```
- Cost: ~$0.01-0.03 per script (Claude API)

**3. Video Rendering (Remotion)**
- Pre-built templates:
  - **"API Alert"** template: animated diff view, red/green highlights, text overlay
  - **"Weekly Digest"** template: carousel of changes with transitions
  - **"Breaking Change"** template: dramatic reveal, before/after split
- Render via Remotion Lambda or locally
- Auto-add captions (burned in for TikTok/Reels)

**4. Review Queue**
- Generated videos land in a queue (Notion board, Slack channel, or simple web dashboard)
- Alex reviews, approves, or tweaks before posting
- Option to record a voiceover/talking head intro and splice it in via CapCut

**5. Distribution**
- Approved videos auto-posted via Buffer, Publer, or native scheduling
- Platform-specific adjustments: aspect ratio, caption style, hashtags

### Weekly "API Changelog Digest" (Automated Series)
- Every Friday, aggregate the week's detected changes
- Auto-generate a 60-second video: "5 API changes you missed this week"
- Remotion template renders each change as a card with animated transitions
- Alex records a 10-second intro, spliced onto the front
- Cross-post to all platforms

### What CAN'T Be Automated
- Talking head / founder journey content (Alex records these manually)
- Hot takes / opinion pieces (need human judgment)
- Trend-jacking (need to be reactive, not scheduled)
- Community engagement (replies, comments, DMs)

---

## 6. Ready-to-Record Scripts

All scripts follow anti-slop rules from `CHIRRI_COPYWRITING_GUIDE.md`: no generic intros, specific language, developer-native voice, no corporate tone.

### Script 1: "The API That Changed at 2 AM"
**Platform:** TikTok / YouTube Shorts
**Length:** 45 seconds
**Visual:** Screen recording + talking head

```
[SHOW: Terminal with Chirri output]
"At 2:47 AM last Tuesday, [API name] changed their authentication flow."

[SHOW: Diff view, red/green]
"They went from API key in the header to OAuth2-only. No deprecation notice. No blog post. Nothing."

[SHOW: Twitter screenshots of confused devs]
"By 9 AM, three Hacker News posts. By noon, a hundred broken integrations."

[TALKING HEAD]
"I built a tool that would have caught this 6 hours before anyone noticed. It runs every hour, diffs every endpoint."

[SHOW: Chirri dashboard]
"Link in bio if you want to stop finding out about breaking changes from your users."
```

### Script 2: "UptimeRobot Says You're Fine. You're Not Fine."
**Platform:** TikTok / X
**Length:** 30 seconds
**Visual:** Split screen comparison

```
[SPLIT SCREEN: UptimeRobot showing "UP" on left]
"Your monitoring says everything is fine."

[RIGHT SIDE: Chirri diff showing changed API response]
"But the API response changed three fields, deprecated an endpoint, and added a rate limit you don't know about."

"Uptime monitoring checks if the lights are on. It doesn't check if someone rearranged the furniture."

[SHOW: Chirri alert]
"Chirri checks the furniture."
```

### Script 3: "I Diff'd 50 API Terms of Service"
**Platform:** TikTok / YouTube Shorts
**Length:** 60 seconds
**Visual:** Screen recording montage

```
[SHOW: List of 50 APIs scrolling]
"I pointed a diff engine at the terms of service for 50 APIs. Then I waited a month."

[SHOW: Results summary]
"17 of them changed their terms. Here are the three you should care about."

[SHOW: Diff 1]
"[API 1] added a clause that lets them use your data for training. Buried in paragraph 47."

[SHOW: Diff 2]
"[API 2] changed their SLA from 99.9% to 99.5%. That's 4x more allowed downtime."

[SHOW: Diff 3]
"[API 3] removed their commitment to 30-day deprecation notices. They can now break anything, anytime."

"Nobody reads terms of service. I built a tool that reads them for you. Every hour."
```

### Script 4: "5 Signs Your API Is About to Break"
**Platform:** YouTube Shorts / TikTok
**Length:** 45 seconds
**Visual:** Numbered list with examples

```
"Five signs the API you depend on is about to break your app."

[TEXT ON SCREEN: #1]
"One. The docs page has a 'v2' section that's been 'coming soon' for six months."

[TEXT ON SCREEN: #2]
"Two. They just hired a new VP of Engineering. Architecture changes incoming."

[TEXT ON SCREEN: #3]
"Three. Response times are getting slower every week. Something's being rewritten."

[TEXT ON SCREEN: #4]
"Four. The changelog hasn't been updated in 3 months. Either nothing changed or everything changed and they forgot to tell you."

[TEXT ON SCREEN: #5]
"Five. They announced 'exciting platform improvements.' That's corporate for 'we're breaking things.'"

"I monitor 100 APIs for exactly these patterns. Follow for the alerts."
```

### Script 5: "Stripe vs Everyone: How to Handle Deprecation"
**Platform:** YouTube Shorts / TikTok
**Length:** 60 seconds
**Visual:** Comparison slides

```
[SHOW: Stripe deprecation email]
"Stripe gives you a 2-year deprecation window. Two. Years."

[SHOW: Timeline graphic]
"They announce it. They email you. They put it in the dashboard. They give you migration guides. They send reminders."

[SHOW: Contrast -- generic API]
"Now here's what most APIs do."

[SHOW: Empty page]
"Nothing. They just change it. Maybe there's a tweet. Maybe."

"The average API deprecation notice is 30 days. The median is zero."

"That's why I built something that watches. Not for uptime. For change."
```

### Script 6: "What Happened When UptimeRobot Killed Free Plans"
**Platform:** TikTok / X
**Length:** 45 seconds
**Visual:** Reddit screenshots + Chirri demo

```
[SHOW: Reddit post "UptimeRobot killing legacy plans -- 425% price increase"]
"UptimeRobot just told paying customers their $8/month plan is now $34. Same features."

[SHOW: More Reddit threads]
"r/selfhosted is on fire. r/sysadmin is listing alternatives. Developers are migrating."

[TALKING HEAD]
"Here's the thing though. UptimeRobot checks if your site is up. That's it. It doesn't tell you what changed."

[SHOW: Chirri diff]
"I want to know WHAT changed. Not just that it's still responding 200 OK."

"Different problem. Different tool."
```

### Script 7: "Building in Public: Week 1 Numbers"
**Platform:** TikTok / X thread
**Length:** 30 seconds
**Visual:** Numbers on screen

```
"Week [X] of building Chirri in public."

[SHOW: Dashboard/metrics]
"[X] APIs monitored. [X] changes detected. [X] users."

"Revenue: $[amount]. Cost to run: $[amount]."

"This week I [specific thing]. It took [specific time]. [One honest sentence about how it went]."

"Next week: [specific plan]."

"That's it. No inspirational quote. Just the numbers."
```

### Script 8: "The $40K Bug Nobody Saw Coming"
**Platform:** TikTok / YouTube Shorts
**Length:** 60 seconds
**Visual:** Storytelling with visuals

```
"A startup I know lost $40,000 in a single weekend."

"Not from a hack. Not from downtime. From a date format change."

[SHOW: Code example]
"Their payment provider changed timestamps from ISO 8601 to Unix epochs. Tuesday night. No announcement."

[SHOW: Error logs]
"By Saturday, every recurring payment had been processed with the wrong date. Double charges. Missed charges. Refund nightmare."

"They found out Monday morning when customer support emails hit triple digits."

[SHOW: Chirri diff]
"A diff engine would have caught this in under an hour. Before a single payment processed."

"The fix took 4 lines of code. Finding out about it took 4 days."
```

### Script 9: "Your API Docs Are Lying to You"
**Platform:** TikTok
**Length:** 30 seconds
**Visual:** Screen recording comparison

```
[SHOW: API docs page]
"These docs say this endpoint returns 5 fields."

[SHOW: Actual API response]
"The actual response has 8 fields. Three of them undocumented."

"Or worse -- the docs say the field is a string. The API sends an integer. 40% of the time."

"API docs are a best-case snapshot. The API is what actually runs."

"I built a tool that watches what actually runs."
```

### Script 10: "Why I Watch APIs for a Living"
**Platform:** TikTok / Instagram Reels
**Length:** 45 seconds
**Visual:** Talking head, casual

```
[TALKING HEAD - casual setting]
"My friends think I'm weird. I monitor websites for a living."

"Not like, checking if they're up. I watch for what changes. API responses. Doc pages. Terms of service."

"Here's why: I was building a project in 2023. The API I depended on changed their auth. No warning. My app broke for 800 users."

"I found out from an angry email. Not from my monitoring. Not from the API provider. From Chad in accounting who couldn't export his reports."

"So I built the thing that would have saved me. It diffs 100+ APIs every hour and tells me exactly what changed."

"That's Chirri. That's the whole thing."
```

### Script 11: "This Week in API Changes"
**Platform:** YouTube Shorts (weekly series)
**Length:** 60 seconds
**Visual:** Remotion-generated template

```
[ANIMATED INTRO: "This Week in API Changes" branded]

"Five things that changed in APIs this week."

[CARD 1 - animated diff]
"[API name]: New rate limit. 100 req/min down from 500."

[CARD 2 - animated diff]
"[API name]: Added a required field to POST /users. Hope you're validating."

[CARD 3 - animated diff]
"[API name]: Quietly removed XML support. JSON only now."

[CARD 4 - animated diff]
"[API name]: Changed error codes. 422 is now 400. Your error handling just broke."

[CARD 5 - animated diff]
"[API name]: New webhook format. Old format works until [date]."

"All caught by Chirri. Follow for next week's digest."
```

### Script 12: "The API Graveyard"
**Platform:** TikTok / YouTube Shorts
**Length:** 45 seconds
**Visual:** Gravestones animation (Remotion)

```
[SHOW: Animated gravestones]
"Welcome to the API graveyard."

[GRAVESTONE: "Google+ API, 2011-2019"]
"Remember when Google killed Google+ and took the API with it? 18 months warning at least."

[GRAVESTONE: "Parse, 2013-2017"]
"Parse gave you a year. Generous."

[GRAVESTONE: "Fabric, 2014-2020"]
"Fabric got absorbed into Firebase. Migration docs were... okay."

[GRAVESTONE: "?" with today's date]
"One of the APIs you use right now is next. The question is: will you find out before or after your users do?"
```

---

## 7. Growth Tactics

### Hashtags by Platform

**TikTok:**
- Primary: #techtok #developer #coding #programming #api
- Secondary: #softwareengineer #webdev #devtools #buildinpublic
- Niche: #apichanges #breakingchanges #devlife #codinglife
- Trending (rotate): #learntocode #techstartup #indiehacker

**X (Twitter):**
- #buildinpublic #devtools #api #webdev #indiedev
- Don't overuse -- 1-2 per tweet max, embedded naturally

**YouTube Shorts:**
- Tags (in description): API monitoring, developer tools, API changes, web monitoring, breaking changes
- Title keywords matter more than hashtags

**Instagram Reels:**
- Same as TikTok but add: #startuplife #saas #techfounder

### Communities to Engage

1. **Hacker News** -- Post launches, interesting API change findings
2. **r/programming, r/webdev, r/selfhosted, r/sysadmin** -- Share value-first content
3. **Dev.to** -- Repurpose video scripts as articles
4. **Indie Hackers** -- Build in public updates
5. **Product Hunt** -- Launch when ready
6. **Dev Twitter** -- Reply to API drama threads, add value with Chirri data
7. **Discord servers** -- Theo's Discord, Fireship Discord, relevant dev communities

### Cross-Posting Strategy
- **Create for TikTok first** (vertical, 9:16, captions burned in)
- **Repurpose to YouTube Shorts** (same file, different title/description)
- **Repurpose to Instagram Reels** (same file, different caption/hashtags)
- **Extract clip for X** (15-30 second highlight, or convert key point to text thread)
- **Write blog post from script** (Dev.to, Chirri blog -- SEO value)

### Engagement Tactics
- Reply to EVERY comment in first hour (algorithm boost)
- Ask questions at end of videos ("What API has burned you?")
- Duet/stitch other dev creators' content on TikTok
- Quote-tweet API news on X with Chirri's diff data
- Create "API Drama Alert" as a recurring series people follow for

---

## 8. The UptimeRobot Angle

UptimeRobot's recent moves create a perfect content opportunity:

### Context
- Oct 2024: UptimeRobot changed ToS -- no more free commercial monitoring
- Nov 2024: Users on r/msp and r/sysadmin seeking alternatives
- July 2025: Legacy plan forced migration -- $8/mo to $34/mo (425% increase)
- Active Reddit threads with hundreds of comments seeking alternatives

### Content Ideas

1. **"UptimeRobot checks if the lights are on. I check if someone rearranged your house."**
   - Position Chirri as a different category, not a direct competitor
   - Not replacement -- complementary (or better yet, a category upgrade)

2. **"What UptimeRobot can't tell you"**
   - Show a 200 OK response where the API payload completely changed
   - "Your monitoring says everything is fine. But the response has 3 new required fields."

3. **"The monitoring gap nobody talks about"**
   - Uptime monitoring: is it responding?
   - Chirri monitoring: what is it responding WITH?

4. **"I built what UptimeRobot should have been"**
   - Founder story angle -- why status codes aren't enough

5. **"$8 to $34 overnight: The UptimeRobot pricing saga"**
   - Pure API Drama content -- cover the pricing change itself
   - Chirri caught UptimeRobot's own pricing page change (meta!)

6. **"Your 99.9% uptime means nothing if the API response changed"**
   - Educational angle

7. **Comment on every Reddit thread** about UptimeRobot alternatives
   - Not spamming -- genuinely explaining the difference between uptime and change monitoring
   - Link to Chirri only when specifically relevant

### Tone
- Don't trash UptimeRobot. Position Chirri as a different (better?) approach.
- "Uptime monitoring is table stakes. Change intelligence is what's next."
- Let the UptimeRobot frustration do the marketing. Just be present when people are looking for alternatives.

---

## 9. Metrics to Track

### Content Performance (weekly)
| Metric | Target (Month 1) | Target (Month 3) | Target (Month 6) |
|--------|------------------|------------------|------------------|
| TikTok followers | 500 | 3,000 | 10,000 |
| X followers | 1,000 | 5,000 | 15,000 |
| YouTube Shorts subs | 200 | 1,500 | 5,000 |
| Avg views per TikTok | 500 | 5,000 | 20,000 |
| Avg views per Short | 200 | 2,000 | 10,000 |
| X impressions/week | 10,000 | 50,000 | 200,000 |

### Engagement (weekly)
- **Comment rate** on TikTok (target: >3%)
- **Save rate** on TikTok (target: >2% -- this is the real algorithm signal)
- **Retweet/quote rate** on X
- **Watch-through rate** on YouTube Shorts (target: >50%)
- **Share rate** across platforms

### Business Impact (monthly)
- **Website visits from social** (UTM-tagged links)
- **Signup attribution** ("How did you hear about us?" -- add social options)
- **Waitlist/beta signups** from social CTAs
- **Inbound DMs/messages** from potential users
- **PR/media mentions** driven by social content
- **Community growth** (Discord, newsletter if applicable)

### Content Operations
- **Videos produced per week** (target: 8-10)
- **Automated videos generated** (target: 3-5/week once pipeline is live)
- **Time per manual video** (target: <45 min from idea to posted)
- **Cost per video** (target: <$1 for automated, $0 for manual)

---

## 10. Budget Estimate

### Monthly Cost Breakdown

| Category | Tool/Cost | Monthly |
|----------|-----------|---------|
| **Video Tools** | | |
| Remotion | Free (startup license) | $0 |
| CapCut Pro | For AI captions + editing | $10 |
| **Automation** | | |
| AWS Lambda (Remotion rendering) | ~50 videos/month | $5 |
| LLM API (script generation) | ~50 scripts/month | $3 |
| **Scheduling** | | |
| Buffer (or Publer) | Multi-platform scheduling | $15-30 |
| **Optional** | | |
| Microphone (one-time) | USB condenser mic | $50 (one-time) |
| Ring light (one-time) | Basic ring light | $25 (one-time) |
| **Total monthly** | | **$28-48/month** |
| **Total with one-time setup** | | **$103-123 first month** |

### Phase 1 (Months 1-2): Manual + Learning -- ~$30/month
- Alex records all videos manually
- Edit in CapCut Free
- Post manually or with free Buffer tier
- Focus: find what resonates, build initial audience
- Cost: basically $0 (Alex's time is the investment)

### Phase 2 (Months 3-4): Semi-Automated -- ~$50/month
- Build Remotion templates for "API Change of the Week" and "Weekly Digest"
- Automate script generation from diff data
- Alex still records founder/talking-head content manually
- Start CapCut Pro for AI captions
- Add Buffer/Publer for scheduling

### Phase 3 (Months 5+): Full Pipeline -- ~$50/month
- Automated pipeline: diff -> script -> Remotion video -> review queue
- Alex focuses on talking head, hot takes, and quality control
- 50%+ of content is auto-generated, Alex-approved
- Scale to 12-15 posts/week across platforms

### Cost Per Video at Scale
- Automated (Remotion): ~$0.10/video (Lambda + LLM costs)
- Manual (Alex + CapCut): $0 (time cost only)
- **Blended average: under $0.50/video**

### What NOT to Spend On
- HeyGen/Synthesia ($24-89/mo) -- AI avatars look fake, devs will cringe
- Lumen5/generic video tools -- produce corporate-looking content
- Paid TikTok ads (yet) -- organic first, paid amplification only after finding winning content formats
- Freelance video editors (yet) -- Alex should edit his own content initially to develop the voice

---

## Appendix: Lessons from Dev Content Creators

### Fireship (Jeff Delaney) -- Gold Standard
- **What works:** 100-second format created a binge library. Fast-paced, humor + information density. Niche jokes devs love. Memes instead of talking head. Sarcastic but knowledgeable.
- **Growth strategy:** Started niche (Angular + Firebase), expanded gradually. Evergreen content (binge-friendly) + news commentary (viral spikes). Consistent schedule.
- **Apply to Chirri:** Create a signature series ("API Change of the Week" = Chirri's "100 Seconds of Code"). Dense information. Dry humor. No filler.

### Theo (@t3dotgg) -- Opinion-Driven Growth
- **What works:** Strong opinions on frameworks/tools. React-style commentary videos. Built-in-public transparency about his companies.
- **Apply to Chirri:** Alex should have opinions about API deprecation practices, monitoring approaches, developer tooling. Don't be neutral.

### ThePrimeagen -- Authentic Engagement
- **What works:** Genuine reactions, commentary style, community-driven content. Streams create clips that spread on shorts platforms.
- **Apply to Chirri:** React to API drama in real time. Create "reaction" content when major API changes happen.

### levelsio -- Build in Public Master
- **What works:** Radical transparency with numbers. Monthly revenue updates. Indie hacker ethos. Shows the work, not just the result.
- **Apply to Chirri:** Share real metrics. Revenue, user count, API count monitored, bugs fixed. Specific numbers build trust.

### B2B SaaS on TikTok (tl;dv, Semrush, Shopify)
- **What works:** Relatable workplace humor, skits about pain points their tool solves. tl;dv has 2 dedicated in-house creators. Semrush does SEO tips as quick humor. The key: entertainment first, product second.
- **Apply to Chirri:** The "API Drama" pillar IS entertainment for devs. Lead with the drama, not the product.

---

*Strategy by Chirri. No AI slop was harmed in the making of this document.*
*Actually, an AI wrote this. But it followed the rules.*
