# Privacy Policy

**Algo -- AI Growth Assistant**
**Effective Date:** March 1, 2026
**Last Updated:** March 1, 2026

---

## 1. Introduction

Algo ("the App") is an AI-powered voice and text assistant built for the Algonit (AIMM) platform. This Privacy Policy explains how Algonit Ltd. ("we", "us", "our") collects, uses, stores, and protects your personal information when you use the Algo mobile application and associated backend services.

By using Algo, you agree to the collection and use of information in accordance with this policy. If you do not agree with the terms of this policy, please do not use the App.

---

## 2. Information We Collect

### 2.1 Account Information
- Name and email address (provided via your Algonit account)
- Algonit tenant identifier
- Authentication credentials (OAuth tokens; passwords are never stored)

### 2.2 Conversation Data
- Text messages sent to the AI assistant
- Voice recordings submitted for speech-to-text processing
- AI-generated responses and recommendations
- Conversation metadata (timestamps, session identifiers, message counts)

### 2.3 Business Data Accessed via Algonit
- Campaign performance metrics (impressions, clicks, conversions)
- Lead and contact information (names, emails, phone numbers, qualification scores)
- WhatsApp Business messaging history
- Email campaign analytics (open rates, click-through rates)
- Revenue and sales pipeline data
- Social media engagement metrics

Note: This business data resides in the Algonit platform. Algo accesses it via authenticated API calls on your behalf and does not independently store raw business data beyond what is needed for conversation context.

### 2.4 Device Information
- Device type and operating system version
- Push notification tokens (APNs for iOS, FCM for Android)
- App version and build number
- Device locale and timezone

### 2.5 Usage Analytics
- Feature usage patterns (chat, dashboard, voice, notifications)
- Session duration and frequency
- Error reports and crash logs

---

## 3. How We Use Your Information

### 3.1 AI Processing
- Your text and voice messages are sent to third-party AI services (see Section 4) to generate intelligent responses, recommendations, and insights.
- Conversation history is maintained to provide contextual, multi-turn dialogue. This context is stored in Redis (short-term, 24-hour TTL) and PostgreSQL (long-term).

### 3.2 Push Notifications
- Device tokens are used to deliver proactive alerts about your business performance, including lead notifications, campaign milestones, and growth recommendations.
- You can manage notification preferences within the App settings.

### 3.3 Service Improvement
- Aggregated and anonymized usage data may be used to improve the App's AI responses, user experience, and feature set.
- We do not sell your personal data to third parties.

### 3.4 Security and Compliance
- Authentication and authorization data is used to enforce tenant isolation and prevent unauthorized access.
- Audit logs are maintained for security monitoring and incident investigation.

---

## 4. Third-Party Services

Algo integrates with the following third-party services, each with their own privacy policies:

| Service | Purpose | Data Shared |
|---------|---------|-------------|
| **Anthropic (Claude API)** | Primary AI language model for conversation processing | Chat messages, conversation context, business data summaries |
| **OpenAI (GPT-4o, Whisper, TTS)** | Fallback AI model, speech-to-text, and text-to-speech | Chat messages (fallback only), voice audio recordings |
| **Google Firebase (FCM)** | Push notifications for Android devices | Device tokens, notification payloads |
| **Apple Push Notification Service (APNs)** | Push notifications for iOS devices | Device tokens, notification payloads |
| **Algonit Platform** | Source business data and action execution | Authenticated API requests on behalf of the user |
| **Amazon Web Services (AWS)** | Cloud infrastructure hosting | All application data (encrypted at rest and in transit) |

We require all third-party service providers to handle your data in accordance with applicable data protection laws. Please refer to each provider's privacy policy for details:
- Anthropic: https://www.anthropic.com/privacy
- OpenAI: https://openai.com/privacy
- Google Firebase: https://firebase.google.com/support/privacy
- Apple: https://www.apple.com/legal/privacy/
- AWS: https://aws.amazon.com/privacy/

---

## 5. Data Storage and Retention

### 5.1 Storage Infrastructure
- **PostgreSQL 16** (AWS RDS): Persistent storage for user profiles, conversation history, action audit logs, and notification records. Data is encrypted at rest using AES-256.
- **Redis 7** (AWS ElastiCache): Temporary storage for session data, conversation context, and rate limiting. Data has a maximum TTL of 24 hours.
- **AWS S3**: Temporary storage for voice audio files during processing. Audio files are deleted after transcription (maximum 1-hour retention).

### 5.2 Retention Periods
| Data Type | Retention Period |
|-----------|-----------------|
| Conversation messages | 90 days |
| Conversation context (Redis) | 24 hours |
| Audit logs | 1 year |
| Device registrations | Until device is unregistered or account deleted |
| Voice audio files | Deleted after processing (max 1 hour) |
| User account data | Duration of account + 30 days after deletion |
| Push notification history | 30 days |

### 5.3 Data Location
All data is stored in AWS data centers. The primary region is determined by your Algonit account configuration.

---

## 6. Your Rights

Depending on your jurisdiction, you may have the following rights regarding your personal data:

### 6.1 Right to Access
You can request a copy of all personal data we hold about you. Contact us at the address below, and we will provide your data in a machine-readable format (JSON) within 30 days.

### 6.2 Right to Deletion
You can request the deletion of your personal data. Upon receiving a verified request:
- Conversation history will be permanently deleted within 7 days.
- Account data will be removed within 30 days.
- Audit logs will be anonymized (personal identifiers removed) but retained for security compliance.
- Data already transmitted to third-party AI providers is subject to their respective retention and deletion policies.

### 6.3 Right to Data Portability
You can request an export of your data in a structured, commonly used format (JSON). This includes conversation history, notification preferences, and usage summaries.

### 6.4 Right to Rectification
You can request correction of inaccurate personal data by contacting our support team.

### 6.5 Right to Restrict Processing
You can request that we limit how we process your data while a concern is being investigated.

### 6.6 Right to Object
You can object to processing of your data for certain purposes. Note that objecting to core AI processing will prevent the App from functioning.

---

## 7. Security Measures

We implement the following security measures to protect your data:

- **Encryption in transit**: All communication uses TLS 1.3.
- **Encryption at rest**: Database storage is encrypted with AES-256.
- **Authentication**: OAuth 2.0 with JWT (RS256 algorithm) and refresh token rotation.
- **Replay attack prevention**: Refresh tokens are single-use with family-based revocation.
- **Tenant isolation**: Strict data separation between organizations at the database and application layer.
- **Rate limiting**: API rate limits prevent abuse and brute-force attacks.
- **Audit logging**: All data access and modifications are logged for security monitoring.
- **Input validation**: All user inputs are validated and sanitized before processing.
- **Dependency scanning**: Regular automated security scans of application dependencies.

---

## 8. Children's Privacy

Algo is a business productivity tool and is not intended for use by individuals under the age of 16. We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us and we will delete it promptly.

---

## 9. Changes to This Policy

We may update this Privacy Policy from time to time. When we make material changes, we will:
- Update the "Last Updated" date at the top of this page.
- Notify you via in-app notification or email.
- Provide a 30-day notice period before changes take effect.

Your continued use of the App after changes become effective constitutes acceptance of the updated policy.

---

## 10. Contact Information

If you have questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us:

- **Email:** privacy@algonit.com
- **Support:** support@algonit.com
- **Website:** https://www.algonit.com/privacy
- **Mailing Address:** Algonit Ltd., [Address to be added]

For data protection inquiries in the EU, you may also contact our Data Protection Officer at dpo@algonit.com.

---

## 11. Governing Law

This Privacy Policy is governed by the laws of [Jurisdiction to be determined]. Any disputes arising from this policy will be resolved in the courts of [Jurisdiction to be determined].
