import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "AI Market Cap privacy policy — how we collect, use, store, and protect your personal information.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: February 27, 2026
      </p>

      <div className="mt-8 space-y-8 text-sm text-muted-foreground leading-relaxed">
        <p>
          AI Market Cap (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
          operates the AI Market Cap platform (the &quot;Platform&quot;). This
          Privacy Policy explains how we collect, use, disclose, and safeguard
          your information when you visit and use our Platform. Please read this
          policy carefully. By using the Platform, you consent to the practices
          described herein.
        </p>

        {/* 1. Information We Collect */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            1. Information We Collect
          </h2>

          <p className="mt-2">
            <strong className="text-foreground">Account Information.</strong>{" "}
            When you create an account, we collect your name, email address,
            display name, and authentication credentials. If you sign in through
            a third-party provider (Google or GitHub), we receive your name,
            email address, and profile picture from that provider.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Profile Information.</strong>{" "}
            You may optionally provide additional information such as a bio,
            website URL, avatar image, and social media links. Sellers who apply
            for verification may provide additional identity information.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Usage Data.</strong> We
            automatically collect information about your interactions with the
            Platform, including pages visited, models browsed, search queries,
            watchlists created, marketplace interactions, comments, reviews,
            ratings, and bookmarks.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">
              Device &amp; Technical Data.
            </strong>{" "}
            We collect device type, browser type and version, operating system,
            IP address, referring URLs, and general geographic location (derived
            from IP address). We also collect performance data such as page load
            times and error logs.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">
              Cookies &amp; Local Storage.
            </strong>{" "}
            We use cookies and browser local storage to maintain your session,
            remember your preferences (such as theme settings), and support
            analytics. See Section 5 for more details.
          </p>
        </section>

        {/* 2. How We Use Information */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            2. How We Use Your Information
          </h2>
          <p className="mt-2">We use the information we collect to:</p>
          <ul className="mt-2 list-disc list-inside space-y-1.5">
            <li>
              Operate, maintain, and improve the Platform and its features
            </li>
            <li>
              Provide personalized experiences, including model recommendations
              and relevant marketplace listings
            </li>
            <li>
              Process marketplace transactions and facilitate communication
              between buyers and sellers
            </li>
            <li>
              Generate aggregated analytics and insights about Platform usage
              (no individual user data is shared externally)
            </li>
            <li>
              Send service-related communications, including account
              notifications, security alerts, and order updates
            </li>
            <li>
              Detect, prevent, and address fraud, abuse, security incidents, and
              technical issues
            </li>
            <li>
              Enforce our Terms of Service and other policies
            </li>
            <li>
              Comply with legal obligations and respond to lawful requests from
              authorities
            </li>
          </ul>
        </section>

        {/* 3. Data Sharing */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            3. Data Sharing &amp; Third-Party Services
          </h2>
          <p className="mt-2">
            We do not sell your personal information. We may share your
            information in the following limited circumstances:
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Service Providers.</strong> We
            use third-party services to operate the Platform, including:
          </p>
          <ul className="mt-2 list-disc list-inside space-y-1.5">
            <li>
              <strong className="text-foreground">Supabase</strong> — database
              hosting, authentication, and file storage
            </li>
            <li>
              <strong className="text-foreground">Vercel</strong> — website
              hosting, edge functions, and performance analytics
            </li>
            <li>
              <strong className="text-foreground">
                Analytics providers
              </strong>{" "}
              — aggregated, anonymous usage analytics to improve the Platform
              experience
            </li>
          </ul>
          <p className="mt-2">
            These providers process data on our behalf and are bound by their
            respective privacy policies and data processing agreements.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Public Content.</strong> Your
            display name, avatar, public reviews, comments, ratings, and public
            watchlists are visible to other users. Seller profiles and
            marketplace listings are publicly accessible.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Legal Requirements.</strong> We
            may disclose your information if required to do so by law, in
            response to a court order, subpoena, or other legal process, or if
            we believe in good faith that disclosure is necessary to protect our
            rights, your safety, or the safety of others.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Business Transfers.</strong> In
            the event of a merger, acquisition, or sale of assets, your
            information may be transferred as part of that transaction. We will
            notify you of any such change in ownership or control.
          </p>
        </section>

        {/* 4. API & Bot Data */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            4. API &amp; Bot Data
          </h2>
          <p className="mt-2">
            When you access the Platform through our API, we log the following
            information for security, rate limiting, and abuse prevention:
          </p>
          <ul className="mt-2 list-disc list-inside space-y-1.5">
            <li>API key identifier (not the full key)</li>
            <li>Endpoints accessed and request timestamps</li>
            <li>IP address and user agent string</li>
            <li>Request and response sizes</li>
            <li>Rate limit counters and usage metrics</li>
          </ul>
          <p className="mt-2">
            API usage logs are retained for 90 days for operational purposes and
            then automatically purged. Aggregated API usage statistics (total
            requests, popular endpoints) may be retained indefinitely for
            capacity planning.
          </p>
          <p className="mt-2">
            If you use an AI agent, bot, or MCP server to interact with the
            Platform, the same data collection and retention policies apply.
            Automated clients are expected to identify themselves via the
            User-Agent header.
          </p>
        </section>

        {/* 5. Cookies & Tracking */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            5. Cookies &amp; Tracking Technologies
          </h2>
          <p className="mt-2">We use the following types of cookies:</p>
          <ul className="mt-2 list-disc list-inside space-y-1.5">
            <li>
              <strong className="text-foreground">Essential Cookies</strong> —
              required for authentication sessions, session management, and
              security. These cannot be disabled without breaking Platform
              functionality.
            </li>
            <li>
              <strong className="text-foreground">Analytics Cookies</strong> —
              help us understand how users navigate and interact with the
              Platform so we can improve the experience. These collect
              anonymized, aggregated usage data only.
            </li>
            <li>
              <strong className="text-foreground">Preference Cookies</strong> —
              store your settings such as theme (dark/light mode), default
              sorting preferences, and locale.
            </li>
          </ul>
          <p className="mt-2">
            <strong className="text-foreground">How to Opt Out.</strong> Most
            browsers allow you to manage cookie preferences through their
            settings. You can block or delete cookies at any time via your
            browser&apos;s privacy or security settings. Note that disabling
            essential cookies may prevent you from using features that require
            authentication.
          </p>
          <p className="mt-2">
            We do not use third-party advertising cookies or cross-site tracking
            technologies.
          </p>
        </section>

        {/* 6. Data Retention */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            6. Data Retention
          </h2>
          <p className="mt-2">
            <strong className="text-foreground">Account Data.</strong> We retain
            your account information for as long as your account is active.
            After you request account deletion, we remove your personal data
            within 30 days, except where retention is required by law or for
            legitimate business purposes (e.g., fraud prevention).
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Usage Logs.</strong> Individual
            usage logs are retained for 90 days and then automatically purged.
            Aggregated and anonymized usage data may be retained indefinitely
            for analytics and service improvement.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">
              Marketplace Transactions.
            </strong>{" "}
            Records of marketplace transactions (orders, reviews) are retained
            for a minimum of 3 years for dispute resolution and legal compliance
            purposes, even after account deletion.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Deletion Requests.</strong> You
            may request deletion of your account and associated data at any time
            through your account settings or by contacting us at{" "}
            <a
              href="mailto:support@aimarketcap.com"
              className="text-neon underline hover:text-neon/80"
            >
              support@aimarketcap.com
            </a>
            . We will process deletion requests within 30 days, subject to any
            legal retention requirements.
          </p>
        </section>

        {/* 7. Data Security */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            7. Data Security
          </h2>
          <p className="mt-2">
            We implement appropriate technical and organizational security
            measures to protect your personal information, including:
          </p>
          <ul className="mt-2 list-disc list-inside space-y-1.5">
            <li>
              Encryption of data in transit (TLS/HTTPS) and at rest
            </li>
            <li>
              Secure authentication through Supabase with support for
              third-party OAuth providers
            </li>
            <li>
              Role-based access controls limiting internal access to personal
              data on a need-to-know basis
            </li>
            <li>
              Regular security reviews and monitoring for unauthorized access
            </li>
            <li>API key hashing and secure storage</li>
          </ul>
          <p className="mt-2">
            <strong className="text-foreground">Breach Notification.</strong> In
            the event of a data breach that affects your personal information, we
            will notify affected users and relevant authorities within 72 hours
            of becoming aware of the breach, as required by applicable law. The
            notification will describe the nature of the breach, the data
            affected, and the steps we are taking to address it.
          </p>
          <p className="mt-2">
            While we strive to protect your information, no method of
            transmission over the internet or electronic storage is 100% secure.
            We cannot guarantee absolute security.
          </p>
        </section>

        {/* 8. Your Rights */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            8. Your Rights
          </h2>
          <p className="mt-2">
            Depending on your location, you may have the following rights
            regarding your personal data:
          </p>
          <ul className="mt-2 list-disc list-inside space-y-1.5">
            <li>
              <strong className="text-foreground">Access</strong> — request a
              copy of the personal data we hold about you
            </li>
            <li>
              <strong className="text-foreground">Correction</strong> — request
              correction of inaccurate or incomplete personal data
            </li>
            <li>
              <strong className="text-foreground">Deletion</strong> — request
              deletion of your personal data, subject to legal retention
              requirements
            </li>
            <li>
              <strong className="text-foreground">Data Portability</strong> —
              request a machine-readable export of your personal data
            </li>
            <li>
              <strong className="text-foreground">Restriction</strong> — request
              that we limit processing of your personal data in certain
              circumstances
            </li>
            <li>
              <strong className="text-foreground">Objection</strong> — object to
              the processing of your personal data for certain purposes
            </li>
            <li>
              <strong className="text-foreground">Withdrawal of Consent</strong>{" "}
              — withdraw consent at any time where processing is based on
              consent
            </li>
          </ul>
          <p className="mt-2">
            To exercise any of these rights, please contact us at{" "}
            <a
              href="mailto:support@aimarketcap.com"
              className="text-neon underline hover:text-neon/80"
            >
              support@aimarketcap.com
            </a>
            . We will respond to requests within 30 days. These rights are
            provided in alignment with the General Data Protection Regulation
            (GDPR) and the California Consumer Privacy Act (CCPA).
          </p>
          <p className="mt-2">
            <strong className="text-foreground">
              California Residents (CCPA).
            </strong>{" "}
            If you are a California resident, you have the right to know what
            personal information we collect, request its deletion, and opt out
            of any sale of personal information. As noted above, we do not sell
            personal information.
          </p>
        </section>

        {/* 9. Children's Privacy */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            9. Children&apos;s Privacy
          </h2>
          <p className="mt-2">
            The Platform is not directed at children under the age of 13. We do
            not knowingly or intentionally collect personal information from
            children under 13. If we become aware that we have collected personal
            information from a child under 13, we will take steps to delete that
            information promptly.
          </p>
          <p className="mt-2">
            If you are a parent or guardian and believe your child has provided
            us with personal information without your consent, please contact us
            at{" "}
            <a
              href="mailto:support@aimarketcap.com"
              className="text-neon underline hover:text-neon/80"
            >
              support@aimarketcap.com
            </a>{" "}
            so we can take appropriate action.
          </p>
        </section>

        {/* 10. International Transfers */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            10. International Data Transfers
          </h2>
          <p className="mt-2">
            Your information may be transferred to and processed in the United
            States and other countries that may not provide the same level of
            data protection as your country of residence. Our service providers,
            including Supabase and Vercel, operate infrastructure globally.
          </p>
          <p className="mt-2">
            If you are located in the European Union or other regions with data
            transfer regulations, you acknowledge that your data will be
            transferred to and processed in the United States. Where we transfer
            personal data across borders, we ensure appropriate safeguards are
            in place, including standard contractual clauses approved by relevant
            authorities, to protect your information in accordance with this
            Privacy Policy.
          </p>
        </section>

        {/* 11. Changes to Policy */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            11. Changes to This Policy
          </h2>
          <p className="mt-2">
            We may update this Privacy Policy from time to time. For material
            changes, we will provide at least 30 days&apos; advance notice by
            updating the &quot;Last updated&quot; date at the top of this page
            and providing notification via email to registered users or through a
            banner on the Platform.
          </p>
          <p className="mt-2">
            We encourage you to review this Privacy Policy periodically. Your
            continued use of the Platform after changes are posted constitutes
            your acceptance of the updated policy.
          </p>
        </section>

        {/* 12. Contact */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            12. Contact Us
          </h2>
          <p className="mt-2">
            If you have questions or concerns about this Privacy Policy, your
            personal data, or wish to exercise any of your data protection
            rights, please contact us at{" "}
            <a
              href="mailto:support@aimarketcap.com"
              className="text-neon underline hover:text-neon/80"
            >
              support@aimarketcap.com
            </a>{" "}
            or through our{" "}
            <a href="/contact" className="text-neon underline hover:text-neon/80">
              Contact page
            </a>
            .
          </p>
          <p className="mt-2">
            <strong className="text-foreground">
              Data Protection Officer.
            </strong>{" "}
            For data protection inquiries specifically, you may reach our Data
            Protection Officer by sending a message with the subject
            &quot;Privacy Inquiry&quot; to{" "}
            <a
              href="mailto:support@aimarketcap.com"
              className="text-neon underline hover:text-neon/80"
            >
              support@aimarketcap.com
            </a>
            . We aim to respond to all privacy-related requests within 30 days.
          </p>
        </section>
      </div>
    </div>
  );
}
