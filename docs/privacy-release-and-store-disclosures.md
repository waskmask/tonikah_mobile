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
- Release RN's corrected WhatsApp privacy text. No separate AI permission screen
  was added. Existing verification-message permission remains unchanged.
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

## Outstanding Store Requirement

The requested implementation does not add a separate AI consent flow or a
backend AI-consent gate. General policy acceptance is not evidence of specific
AI-sharing permission. Apple guideline 5.1.2(i) expressly addresses permission
before sharing personal data with third-party AI; store acceptance is unresolved.
Selfie and age labels/badge descriptions do not implement either verification flow.

## References

- [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/)
- [Apple Data Use and Sharing](https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing)
- [Google Play Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
- [Twilio Data Privacy FAQs](https://www.twilio.com/en-us/legal/privacy/faqs)
