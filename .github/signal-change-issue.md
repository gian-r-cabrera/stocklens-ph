---
title: "Signal change detected"
labels: signal-change
---

The consensus Buy/Hold/Avoid signal changed for one or more tracked tickers:

{{ env.SUMMARY }}

Ticker list: `data/notify-watchlist.json`. Edit it to match your real
watchlist — this runs independently of the in-app watchlist (localStorage,
not readable from a scheduled job).

Close this issue once reviewed. A new one is filed next time a signal changes.
