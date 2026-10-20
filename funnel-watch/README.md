# Funnel Watch — a Claude skill

Track competitors' web quiz funnels and paywalls every day, and get told what changed: quiz steps and copy, funnel pages, plans, prices, trials, A/B variants.

## What you get

- **A private tracker page** in your Claude account: a watchlist you edit yourself (name + funnel URL), a change feed per competitor, the current plans and prices, the funnel map and every quiz step.
- **A daily scheduled task.** Claude opens each funnel in the Claude desktop app's browser, answers the quiz, stops at the paywall without paying, compares with yesterday and sends you a short report.

## Works on any quiz funnel

A generic walker handles option screens, multi-selects, info screens, height/weight/age inputs, name and email gates, cookie banners and marketing opt-ins (it always declines them).

For funnel builders it recognises it reads the funnel's own data as well:
- Rise/Runwayer funnels (e.g. quiz.calm.com): the full screen config plus USD prices for every product, upsells included;
- Next.js + Redux funnels (e.g. quiz.betterme.world): the full quiz tree for every branch, the sales-funnel page map and the whole plan matrix (main plan, exit discount, downsell, promo tiers, upsells).

## Install

1. Upload `funnel-watch.zip` as a skill in Claude's settings.
2. In a new chat, say **"Set up Funnel Watch"** and paste the funnel URLs you want to watch.
3. Claude publishes your tracker, creates the daily task, and can run the first check right away.

## Requirements and limits

- The Claude desktop app must be open and the computer awake at the scheduled time.
- Prices are the ones shown to your computer's IP; use a VPN during the run to see another country's prices.
- A test email (a plus-address works) lets the walker pass email gates; many funnels only show prices after it.
- Some quizzes require a consent checkbox to continue. The walker ticks it only if you enable that on the tracker.
- It never types passwords and never clicks pay, subscribe, start-trial or claim buttons. Captchas and bot walls are reported, not bypassed.

---
© 2026 Dzmitry · https://github.com/Dmtrue94/funnel-watch · Licensed under CC BY-NC 4.0
