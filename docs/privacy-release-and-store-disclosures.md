# Shared Privacy Release

Prepared on October 15, 2026. This is a release handoff based on repository
behavior, not a record of changes made in either store console.

## Deploy Together

- Deploy the Next.js privacy policy, cookie policy, and terms in all 11 locales.
- Deploy the backend legal-version defaults and set these production values:

```env
TERMS_VERSION=2026-10-15
PRIVACY_VERSION=2026-10-15
```

- Restart the API with its updated environment. Existing users whose accepted
  versions are older are handled by the existing terms/privacy acceptance flow.
- Release RN's corrected WhatsApp privacy text. Existing verification-message
  permission remains unchanged. See the October 22 AI permission update below.
- Production RN links use https://tonikah.com/terms and
  https://tonikah.com/privacy-policy. Verify both are available without login.
- The local `.env` and `.env.prod` files also contain the new versions, but are
  ignored by Git. Configure the deployed environment explicitly.

## Provider And Retention Checks

- Local configuration enables OpenAI image checks and Gemini text checks.
  Confirm the deployed provider/base URL and paid service agreements match the
  policy before release. A custom AI endpoint requires corresponding disclosure.
- Confirm the actual AI provider's data-processing regions, retention settings,
  and transfer safeguards. No zero-retention or no-training promise was added.
- Twilio delivers WhatsApp OTPs through WhatsApp/Meta. Codes expire after five
  minutes; expiry alone does not delete the stored challenge or provider records.
- Reported-image evidence defaults to 90 days. Verify
  `REPORT_EVIDENCE_RETENTION_DAYS` and the report-evidence cleanup job.
- Session IP/user-agent anonymization defaults to 30 days after expiry/revocation;
  deleted-account name/email snapshots default to 90 days after account deletion.
  Confirm privacy-cleanup settings and actual scheduled execution.
- Verify backup schedules and any legal holds independently of active storage.
- Web performance telemetry depends on `NEXT_PUBLIC_ENABLE_VERCEL_SPEED_INSIGHTS`
  and deployment configuration. This is not an RN analytics integration.

## Store Console Handoff

Complete Apple App Privacy and Google Play Data Safety for the actual release:

| Data to review | Purpose and recipients to check |
| --- | --- |
| Name, email, phone, account ID, date of birth, gender | Accounts, profile display, verification; Twilio/WhatsApp for OTP data |
| Religion, ethnicity, partner preferences | Profile and matchmaking; text moderation when submitted in moderated fields |
| Photos, profile text, messages, shared media, audio | Profile/chat functionality, reports, safety; OpenAI/Gemini for moderated profile content |
| Precise/coarse location | City lookup and location features; Google Maps/Places |
| Installation identifier, sessions, IP/device information, push tokens | Login/security and notifications; Expo, Firebase, Apple as applicable |
| Purchase history and transaction identifiers | Billing and entitlements; configured payment providers and stores |

Do not describe all private messages or audio as being sent to AI: the reviewed
automatic AI paths apply to profile fields and gallery photos. Determine whether
Google's service-provider sharing exception applies to each recipient rather than
marking every processor automatically as sharing. Assess Apple's linked-to-user
classification based on the account-associated data actually processed.

## AI Permission Update: October 22, 2026

- Deploy the API and image worker changes before the updated Next.js/RN clients.
  Existing accounts have no inferred AI permission. Old clients remain usable,
  but their new profile text and photos go to admin review without publication
  until the account has explicitly permitted AI processing.
- After sign-in and any required legal acceptance, iOS, Android, and web ask for
  a separate account-wide choice: Allow AI checks or Use admin review instead.
  Neither is preselected. The disclosure names OpenAI and Google Gemini,
  describes profile text/photo processing and retention caveats, and explains
  that AI checks can help approved content be published faster.
- The choice can be changed in Data & privacy on mobile or the web settings
  page. PATCH /api/account/me/ai-moderation-consent records a strict boolean,
  disclosure version 2026-10-22, and server-side decision time. Existing
  /api/account/me/privacy-consent responses include aiModeration status.
- Missing, declined, or outdated permission routes submitted Headline, Bio,
  Company, and About Partner text into the existing pending-review candidate
  fields. Previously approved values remain unchanged. New photos remain in
  signed private storage with safe=false and pending_review, without AI jobs.
- Image workers recheck persisted permission at the provider boundary, including
  jobs queued before withdrawal. Admin AI translation is also permission-gated
  and reads content from the specified account rather than trusting submitted
  text. Local checks and human approval/rejection remain available.
- Turning off AI must not publish unreviewed content. Unknown/custom AI provider
  endpoints are not covered by this disclosure and fall back to manual review.
  Bump the consent version and update disclosures before changing recipients or
  the processing scope. No new environment variable is required for this gate.
- Permission changes apply to future checks. They cannot recall data already
  transmitted, and do not promise zero provider retention. Granting permission
  does not automatically resubmit existing manual-review items to AI.
- Verify allow, decline, withdrawal, legacy-account, and worker retry behavior on
  development/test releases before production. No store-console changes or
  deployment are performed by these repository changes; approval is not assured.

Selfie and age labels/badge descriptions do not implement either verification flow.

## Free Store Release Update: October 23, 2026

- Mobile `constants/releaseFeatures.ts` disables membership purchases for this
  release. Menu/settings links and chat promotions are hidden. Direct membership
  links redirect before mounting the paid screen or connecting to store billing.
  Unexpected server membership restrictions show a dismissible error, not an upsell.
  Keep backend `MESSAGING_MEMBERSHIP_POLICY=off`; the client does not bypass server
  authorization. Paid website services remain separate and unchanged.
- All eleven website policy translations now describe free introductory mobile
  access without automatic conversion into a paid subscription. Optional paid
  services require a separate explicit purchase. Terms and privacy default versions
  are `2026-10-23`. Set BOTH backend environment overrides to that version when the
  revised public policies go live; existing `.env` files were not edited.
- Account deletion (self-service or admin) atomically marks conversations deleted,
  removes unread counts, and sets a seven-day purge deadline. Conversation APIs,
  search and starred-message lists exclude scheduled conversations. Media uploads
  and view-once access require an active conversation. Existing client caches and
  already delivered/downloaded copies cannot be remotely erased.
- The existing privacy retention job schedules older deleted accounts' remaining
  conversations using their original deletion dates. At the next successful run
  after seven days it deletes message/upload media, then records, then conversations.
  Storage failures preserve references for retry. `legalHold=true` excludes a
  conversation from the purge; any hold must be recorded before cleanup starts.
  Existing restricted report evidence follows its separate retention process.
- IMPORTANT: deploying this job enables deletion of eligible legacy conversations.
  Verify a database/storage backup and retention requirements before rollout.
  `PRIVACY_RETENTION_DISABLED` must be false. The default job runs daily at 03:35
  in the server's configured timezone, so seven days is eligibility, not an exact
  deletion-time guarantee. Review failed-purge audit counts and logs.
- Publish the website before configuring these store URLs:
  account deletion: `https://www.tonikah.com/en/delete-account`;
  child safety: `https://www.tonikah.com/en/safety#child-safety`.
  Verify both links logged out and confirm privacy@tonikah.com and
  support@tonikah.com are monitored; the code cannot verify mailbox handling.
- Store-console work is still required: Data Safety/App Privacy disclosures,
  child-safety contact/declarations, reviewer account and review instructions,
  age/content ratings, and current screenshots. The RN code audit did not find
  Sign in with Apple; assess/implement the required equivalent login option before
  iOS submission. No Apple authentication credentials or store settings were changed.
- Verify on real iOS/Android release builds: no paid entry points or checkout,
  Google login, report/block, account deletion, AI allow/decline/withdrawal,
  and normal free messaging. Obtain legal review of policy translations and
  retention promises. No deployment, live database purge, build, or store submission
  was performed by this change.

## References

- [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/)
- [Apple Data Use and Sharing](https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing)
- [Google Play Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
- [Twilio Data Privacy FAQs](https://www.twilio.com/en-us/legal/privacy/faqs)
