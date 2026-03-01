# AI Market Cap — Affiliate & Partnership Strategy

**Date**: 2026-03-01
**Goal**: Generate revenue through deployment referrals and platform partnerships
**Estimated Revenue**: $2,250-$10,000/month at ~50K monthly site visits

---

## Tier 1: Sign Up Immediately (Active Programs)

### Google Cloud (Vertex AI)
- **Signup**: https://cloud.google.com/affiliate-program
- **Commission**: Cash rewards per new eligible user, no annual cap
- **Covers**: Vertex AI, Cloud Run, GKE (all model deployment)
- **Est. Revenue**: $500-2,000/mo
- **Action**: Sign up, get tracking link, add to Deploy tab for all models available on Vertex

### Perplexity
- **Signup**: https://partners.dub.co/perplexity
- **Commission**: $15-20 per Comet browser install
- **Note**: Consumer product focus, not API. Good for Perplexity model pages
- **Est. Revenue**: $200-800/mo
- **Action**: Sign up for Dub Partners, add referral link to Perplexity Pro subscription

### RunPod
- **Signup**: https://runpod.io/referral (check dashboard for referral program)
- **Commission**: Credits per referral, varies
- **Covers**: GPU cloud for self-hosting open models
- **Est. Revenue**: $100-400/mo
- **Action**: Create account, get referral link, add to self-hosting section

---

## Tier 2: Enroll in Partner Programs (Requires Application)

### AWS Partner Network (Bedrock)
- **Signup**: https://aws.amazon.com/partners/register
- **Program**: ISV or Consulting Partner track
- **Commission**: Revenue share on referred customers (negotiable after enrollment)
- **Requirements**: AWS technical proficiency, customer referrals
- **Est. Revenue**: $300-1,000/mo (after 2-3 month onboarding)
- **Action**: Register as Technology Partner, pursue Bedrock-specific certification

### Microsoft AI Cloud Partner Program (Azure AI)
- **Signup**: https://partner.microsoft.com/en-us/partnership
- **Program**: Solutions Partner designation
- **Commission**: Revenue share on Azure consumption
- **Requirements**: Microsoft certifications, demonstrated customer solutions
- **Est. Revenue**: $200-800/mo (after certification)
- **Action**: Enroll, pursue AI & Machine Learning specialization

### Lambda Cloud
- **Signup**: https://lambdalabs.com/ (check for referral/partner program)
- **Commission**: Credits-based referral
- **Covers**: GPU cloud for training and inference
- **Est. Revenue**: $100-300/mo
- **Action**: Contact sales team about referral partnership

---

## Tier 3: Pitch Custom Partnerships (No Formal Program)

These platforms don't have public affiliate programs but could benefit from our referral traffic. Pitch them with traffic data after 1-2 months of UTM tracking.

### OpenRouter (HIGHEST POTENTIAL)
- **Contact**: team@openrouter.ai or via Discord
- **Pitch**: "We drive X thousand clicks/month to model deployment pages. We can route users through OpenRouter as a unified API layer. Revenue share on API consumption."
- **Potential**: API routing commission on all traffic we send
- **Est. Revenue**: $500-3,000/mo (highest potential partner)
- **Action**: Start with UTM tracking to demonstrate traffic, pitch after 30 days of data

### Replicate
- **Contact**: team@replicate.com
- **Pitch**: "Our Deploy tab drives one-click deployments. X users click 'Deploy on Replicate' monthly. Custom referral deal."
- **Est. Revenue**: $200-1,000/mo
- **Action**: UTM track first, pitch with data

### Together AI
- **Contact**: sales@together.ai
- **Pitch**: Similar to Replicate — deployment referrals
- **Est. Revenue**: $100-500/mo
- **Action**: UTM track, pitch with data

### Fireworks AI
- **Contact**: Via https://fireworks.ai/partners
- **Pitch**: Technology partner integration
- **Est. Revenue**: $100-400/mo
- **Action**: Apply to partner program, negotiate referral terms

### Groq
- **Contact**: Via website contact or developer relations
- **Pitch**: Speed-focused referrals (Groq's key differentiator)
- **Est. Revenue**: $100-300/mo
- **Action**: UTM track, pitch with data emphasizing speed comparisons

### DeepInfra
- **Contact**: Via website
- **Pitch**: Budget-focused deployment referrals
- **Est. Revenue**: $50-200/mo

### Cerebras
- **Contact**: Via website
- **Pitch**: Speed-focused referrals
- **Est. Revenue**: $50-200/mo

---

## Tier 4: Credits & Startup Programs

### Vast.ai
- **Referral**: https://vast.ai/ (check for referral credits)
- **Commission**: Referral credits
- **Est. Revenue**: $50-200/mo

### Modal
- **Partners**: https://modal.com/partners
- **Program**: Integration partnership + startup credits
- **Est. Revenue**: $50-150/mo

### CoreWeave
- **Contact**: Sales team
- **Program**: Enterprise referrals
- **Est. Revenue**: $100-500/mo (enterprise deals)

---

## Implementation Plan

### Month 1: Foundation
1. Sign up for Google Cloud Affiliate Program
2. Sign up for Perplexity via Dub Partners
3. Create RunPod account and get referral link
4. Add UTM tracking to ALL deploy buttons: `?ref=aimarketcap&utm_source=aimarketcap&utm_medium=deploy_tab`
5. Set up Google Analytics to track deploy button clicks by platform

### Month 2: Data Collection
1. Collect 30 days of click data per platform
2. Enroll in AWS Partner Network
3. Begin Microsoft Partner enrollment
4. Contact Lambda Cloud about referral program

### Month 3: Outreach
1. Pitch OpenRouter with traffic data
2. Pitch Replicate with deployment click data
3. Pitch Together AI, Fireworks, Groq with data
4. Apply to remaining partner programs

### Month 4+: Optimization
1. A/B test deploy button placement and copy
2. Negotiate better rates with data proving conversion
3. Add more platforms as they launch affiliate programs
4. Consider OpenRouter as primary routing layer (highest margin)

---

## Revenue Projection

| Timeline | Monthly Revenue | Notes |
|----------|-----------------|-------|
| Month 1 | $200-500 | Google Cloud + Perplexity only |
| Month 3 | $800-2,000 | + AWS, RunPod, Lambda |
| Month 6 | $2,000-5,000 | + Custom deals (OpenRouter, Replicate) |
| Month 12 | $5,000-10,000 | Full optimization, all partners active |

---

## Tracking Setup

All affiliate/referral links use consistent UTM parameters:
```
?ref=aimarketcap
&utm_source=aimarketcap
&utm_medium=deploy_tab
&utm_campaign={platform_slug}
&utm_content={model_slug}
```

Track in Google Analytics:
- Event: `deploy_click`
- Properties: `platform`, `model`, `pricing_model`, `estimated_value`

Dashboard: Monthly report showing clicks, conversions (where trackable), and revenue per platform.
