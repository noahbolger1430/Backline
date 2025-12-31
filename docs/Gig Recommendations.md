# How Gig Recommendations Work

At Backline, we believe in transparency. This document explains exactly how we recommend gigs to bands, so you can understand why certain opportunities appear at the top of your feed.

---

## Overview

When you visit the **Available Gigs** page, you'll see a "Recommended for You" section at the top. These aren't random—they're gigs we think are a great fit for your band based on multiple factors we analyze behind the scenes.

Our recommendation system uses two main approaches:

1. **Rule-Based Scoring** — We look at specific attributes of your band and compare them to what venues are looking for
2. **Collaborative Filtering** — We look at which bands have been successful at specific venues and find patterns

Each gig receives a **recommendation score**, and the highest-scoring gigs appear first in your recommendations.

---

## Rule-Based Scoring

Think of this as a checklist. For each potential gig, we ask several questions and award points based on the answers.

### 1. Availability Match (Up to 25 points)

**What we check:** Is your band available on the date of the gig?

If you've set your availability in your band profile and the gig falls on a date you're free, you'll receive a full 25 points. This is one of the most important factors—after all, there's no point recommending a Friday night gig if you're already booked!

**For bands:** Keep your availability calendar up to date to get better recommendations.

---

### 2. Genre Match (Up to 35 points)

This is where things get interesting. We use a tiered approach to genre matching:

#### Tier 1: Event Genre Tags (Highest Priority)
When a venue creates an event, they can specify exactly what genres they're looking for (e.g., "Looking for: Jazz, Blues, Soul"). If your band's genre matches:

| Match Type | Points | Example |
|------------|--------|---------|
| **Exact match** | 35 points | Your genre is "Jazz" and the event wants "Jazz" |
| **Partial match** | 25 points | Your genre is "Blues" and the event wants "Blues Rock" |

#### Tier 2: Venue History (Medium Priority)
If the event doesn't specify genres, we look at what types of bands the venue has booked in the past:

| Match Type | Points | Example |
|------------|--------|---------|
| **Exact match** | 20 points | You play "Indie Rock" and the venue has booked Indie Rock bands before |
| **Partial match** | 14 points | You play "Folk" and the venue has booked "Folk Rock" bands |

#### Tier 3: Discovery (Fallback)
If we don't have genre data to work with, we still give a small score (6 points) because it might be a new opportunity worth exploring.

**For venues:** Adding genre tags when creating events helps the right bands find you faster!

**For bands:** Make sure your genre is accurately set in your profile.

---

### 3. Past Success at Venue (Up to 20 points)

**What we check:** Have you played at this venue before and been accepted?

If you've previously applied to gigs at a venue and been accepted, you receive 20 bonus points. Venues tend to re-book bands they've had good experiences with, so these opportunities are often a great fit.

---

### 4. Past Rejections (Up to -15 points)

**What we check:** Have you been rejected by this venue before?

We're honest here—if a venue has rejected your applications in the past, we slightly reduce the recommendation score (-15 points). This doesn't mean you shouldn't apply! Venues' needs change, and persistence can pay off. But we want to prioritize opportunities where you're more likely to succeed.

---

### 5. Freshness Bonus (Up to 15 points)

**What we check:** Is this a newly posted gig?

Gigs posted within the last 48 hours receive a 15-point bonus. Applying early often gives you a better chance of being considered before the venue fills their slots.

---

### 6. Low Competition Bonus (Up to 10 points)

**What we check:** How many bands have already applied?

Gigs with fewer than 5 applications receive a 10-point bonus. Less competition means better odds!

---

## Collaborative Filtering

This is where the magic of "bands like you" comes into play.

### The Concept

Instead of just looking at your band's attributes, we look at behavior patterns across all bands on the platform. Specifically:

> **"If bands similar to yours have been successful at a venue, you might be too."**

### How We Define "Similar Bands"

Two bands are considered "similar" if they've both been accepted to perform at the same venues. The logic is simple:

- If Venue A books both your band and another band, that venue sees something similar in both of you
- If that other band gets booked at Venue B, Venue B might like you too

### Scoring

When we find that similar bands have been accepted at a venue:

| Situation | Points | What You'll See |
|-----------|--------|-----------------|
| **3+ similar bands** accepted here | 25 points | "Bands like yours played here" |
| **2 similar bands** accepted here | 18 points | "Similar bands played here" |
| **1 similar band** accepted here | 12 points | "A similar band played here" |
| **Same-genre bands** accepted here (fallback) | 8 points | "Other bands in your genre played here" |

### Why This Works

Collaborative filtering captures patterns that rule-based scoring might miss. For example:

- Maybe a venue doesn't list a specific genre, but consistently books certain types of acts
- Maybe two genres go well together at a particular venue (like "Acoustic Folk" and "Singer-Songwriter")
- Maybe a venue owner has a specific taste that transcends genre labels

By looking at actual booking patterns, we can surface opportunities you might not have found otherwise.

---

## Putting It All Together

Your final recommendation score is the sum of all applicable factors:

```
Total Score = Availability + Genre Match + Past Success + Freshness + Competition Bonus + Collaborative Score
              (minus any rejection penalty)
```

### Example Scenario

Let's say you're in a Jazz trio looking at a gig:

| Factor | Score | Reason |
|--------|-------|--------|
| Availability | +25 | You're free that night |
| Genre Match | +35 | Event specifically wants Jazz |
| Past Success | +0 | Never played here before |
| Rejection Penalty | +0 | Never been rejected here |
| Freshness | +15 | Posted yesterday |
| Low Competition | +0 | Already has 8 applications |
| Collaborative | +18 | 2 bands you've shared venues with played here |
| **Total** | **93 points** | High recommendation! |

---

## What You'll See in the App

Each recommended gig shows tags explaining why we think it's a good fit:

- 🎯 **"Genre matches event"** — The venue specifically asked for your genre
- 🎵 **"Genre fits venue"** — The venue has booked your genre before
- ✓ **"Previously accepted here"** — You've played here successfully
- ⚡ **"New opportunity"** — Freshly posted gig
- 👥 **"Low competition"** — Few bands have applied
- 🤝 **"Bands like yours played here"** — Collaborative filtering found a pattern

---

## Tips for Better Recommendations

### For Bands:
1. **Keep your availability updated** — The more accurate your calendar, the better your recommendations
2. **Set your genre accurately** — Don't over-tag; pick what truly represents your sound
3. **Apply to gigs that fit** — Your application history helps us learn what venues appreciate your style

### For Venues:
1. **Add genre tags to events** — Helps the right bands find you faster
2. **Be specific about what you're looking for** — The more detail, the better matches you'll get
3. **Review applications promptly** — Your booking history helps our system make better recommendations for everyone

---

## Transparency Commitment

We don't hide anything about how recommendations work. There are:

- **No paid placements** — Venues can't pay to appear higher in band recommendations
- **No hidden factors** — Everything that affects your score is documented here
- **No black boxes** — We've explained our algorithms in plain language

If you have questions about how a specific recommendation was generated, reach out to our support team.

---

## Frequently Asked Questions

**Q: Why do I see some gigs I'm not interested in?**

A: Our system can only work with the data it has. If your genre or availability isn't set correctly, or if a venue hasn't specified what they're looking for, matches may be less accurate. Updating your profile helps!

**Q: Can I disable recommendations and just see all gigs?**

A: Yes! The recommendations section is just a helpful starting point. You can scroll past it to see all available gigs with full filtering options.

**Q: How often are recommendations updated?**

A: Every time you visit the Available Gigs page, we recalculate recommendations based on the latest data.

**Q: Does applying to a gig affect my future recommendations?**

A: Yes—your application history (acceptances and rejections) influences future recommendations at those venues.

---

*Last updated: December 2024*

