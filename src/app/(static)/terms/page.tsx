import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "AI Market Cap terms of service — rules governing your use of the platform, marketplace, and API.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: February 27, 2026
      </p>

      <div className="mt-8 space-y-8 text-sm text-muted-foreground leading-relaxed">
        {/* 1. Acceptance of Terms */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            1. Acceptance of Terms
          </h2>
          <p className="mt-2">
            By accessing, browsing, or using AI Market Cap (the
            &quot;Platform&quot;), you acknowledge that you have read,
            understood, and agree to be bound by these Terms of Service
            (&quot;Terms&quot;). If you are using the Platform on behalf of an
            organization, you represent and warrant that you have the authority
            to bind that organization to these Terms, and references to
            &quot;you&quot; include that organization.
          </p>
          <p className="mt-2">
            If you do not agree with any part of these Terms, you must
            immediately discontinue all use of the Platform. Your continued use
            of the Platform following any modifications to these Terms
            constitutes acceptance of those changes.
          </p>
        </section>

        {/* 2. Description of Service */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            2. Description of Service
          </h2>
          <p className="mt-2">
            AI Market Cap is a platform for tracking, ranking, and comparing
            artificial intelligence models. The Platform provides benchmark
            scores, pricing data, community ratings, download statistics, Elo
            rankings, and other metrics aggregated from public and third-party
            sources.
          </p>
          <p className="mt-2">
            Additionally, the Platform operates a marketplace where users may
            list and purchase AI-related products and services, including but not
            limited to fine-tuned model weights, API access packages, datasets,
            prompt templates, AI agents, and MCP servers.
          </p>
          <p className="mt-2">
            The Platform also offers an API for programmatic access to model
            data, rankings, and marketplace information, subject to the API
            terms outlined in Section 5 below.
          </p>
        </section>

        {/* 3. User Accounts */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            3. User Accounts
          </h2>
          <p className="mt-2">
            <strong className="text-foreground">Age Requirement.</strong> You
            must be at least 13 years of age to create an account or use the
            Platform. If you are between 13 and 18 years of age (or the age of
            majority in your jurisdiction), you may only use the Platform under
            the supervision of a parent or legal guardian who agrees to be bound
            by these Terms.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Registration.</strong> Certain
            features of the Platform require you to create an account. You may
            register using an email address and password or through supported
            third-party authentication providers (e.g., Google, GitHub). You
            agree to provide accurate, current, and complete information during
            registration and to keep your account information up to date.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Account Security.</strong> You
            are solely responsible for maintaining the confidentiality of your
            account credentials and for all activities that occur under your
            account. You agree to notify us immediately of any unauthorized use
            of your account or any other breach of security. We are not liable
            for any loss arising from unauthorized access to your account.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Account Termination.</strong> We
            reserve the right to suspend or terminate your account at any time,
            with or without notice, for conduct that we determine, in our sole
            discretion, violates these Terms, is harmful to other users or the
            Platform, or for any other reason.
          </p>
        </section>

        {/* 4. Marketplace Terms */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            4. Marketplace Terms
          </h2>
          <p className="mt-2">
            <strong className="text-foreground">Listing Policies.</strong>{" "}
            Sellers are responsible for ensuring that all marketplace listings
            are accurate, complete, and not misleading. All pricing must be
            clearly stated and kept up to date. Listings must not infringe on
            any third-party intellectual property rights, violate applicable
            laws, or contain malicious code. We reserve the right to remove any
            listing that violates these policies without notice.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Transaction Terms.</strong>{" "}
            Transactions on the marketplace are between the buyer and seller. AI
            Market Cap facilitates the connection and provides the order tracking
            system but is not a party to the transaction itself. All pricing,
            delivery, and fulfillment terms are as described in each listing.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">No Guaranteed Outcomes.</strong>{" "}
            AI Market Cap does not guarantee the performance, quality, or
            suitability of any product or service listed on the marketplace.
            Buyers acknowledge that outcomes may vary and that marketplace
            listings are provided by third-party sellers, not by AI Market Cap.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">
              Buyer Responsibilities.
            </strong>{" "}
            Buyers agree to review listing details, seller ratings, and reviews
            before making a purchase. Buyers are responsible for verifying that a
            product or service meets their requirements before completing a
            transaction.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">
              Seller Responsibilities.
            </strong>{" "}
            Sellers agree to deliver products and services as described in their
            listings, maintain pricing accuracy, respond to buyer inquiries in a
            timely manner, and comply with all applicable laws and regulations.
            Sellers are solely responsible for any tax obligations arising from
            their sales.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Dispute Resolution.</strong> In
            the event of a dispute between a buyer and seller, we encourage
            parties to resolve the matter directly. If direct resolution fails,
            either party may contact our support team at{" "}
            <a
              href="mailto:support@aimarketcap.com"
              className="text-neon underline hover:text-neon/80"
            >
              support@aimarketcap.com
            </a>{" "}
            for mediation. AI Market Cap may, at its sole discretion, mediate
            disputes or take action including issuing refunds, suspending
            accounts, or removing listings. Our decisions in dispute resolution
            are final.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Seller Verification.</strong>{" "}
            Sellers may apply for verified status, which provides enhanced
            visibility and trust badges. Verification requires identity
            confirmation and review of listing history. Verified status may be
            revoked at any time if a seller violates these Terms.
          </p>
        </section>

        {/* 5. API & Bot Usage */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            5. API &amp; Bot Usage
          </h2>
          <p className="mt-2">
            <strong className="text-foreground">API Access.</strong> Access to
            the AI Market Cap API is provided through API keys issued to
            registered users. Your API key is personal and non-transferable. You
            are responsible for all usage associated with your API key and must
            keep it confidential.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Rate Limits.</strong> API access
            is subject to rate limits as published in our API documentation.
            Exceeding rate limits may result in temporary or permanent
            suspension of your API access. We reserve the right to modify rate
            limits at any time.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">No Scraping.</strong> Automated
            scraping, crawling, or data extraction from the Platform website is
            strictly prohibited without prior written consent. All programmatic
            access to Platform data must be conducted through the authorized
            API.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">
              Bot &amp; Agent Identification.
            </strong>{" "}
            Bots, AI agents, and MCP servers may interact with the Platform
            through the API. All automated actors must identify themselves
            appropriately via the User-Agent header and comply with all API rate
            limits and usage policies. Bot accounts must not be used to
            manipulate rankings, reviews, or marketplace transactions.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Data Usage.</strong> Data
            obtained through the API may be used for non-commercial research,
            internal analytics, and application integration. Republishing bulk
            data or building a competing service using our data is prohibited
            without prior written consent.
          </p>
        </section>

        {/* 6. Intellectual Property */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            6. Intellectual Property
          </h2>
          <p className="mt-2">
            <strong className="text-foreground">Platform Ownership.</strong> All
            content on the Platform, including but not limited to text, graphics,
            logos, icons, images, data compilations, software, and the overall
            design and architecture of the Platform, is the property of AI
            Market Cap or its content suppliers and is protected by intellectual
            property laws. You may not reproduce, distribute, or create
            derivative works from Platform content without our prior written
            consent.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">
              User Content Rights.
            </strong>{" "}
            You retain ownership of all content you submit to the Platform,
            including reviews, comments, ratings, and marketplace listings. You
            may request removal of your content at any time, subject to our
            operational requirements.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">
              License for User-Generated Content.
            </strong>{" "}
            By submitting content to the Platform, you grant AI Market Cap a
            worldwide, non-exclusive, royalty-free, perpetual license to use,
            display, reproduce, and distribute such content in connection with
            the operation of the Platform. This license is necessary for us to
            display your reviews, comments, and listings to other users.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">DMCA &amp; Takedowns.</strong>{" "}
            We respect intellectual property rights and will respond to valid
            notices of alleged copyright infringement in accordance with the
            Digital Millennium Copyright Act (DMCA). If you believe your
            copyrighted work has been used in a way that constitutes
            infringement, please submit a takedown notice to our designated
            agent via the Contact page with: (a) identification of the
            copyrighted work, (b) identification of the infringing material, (c)
            your contact information, (d) a statement of good faith belief, and
            (e) a statement under penalty of perjury that the information is
            accurate.
          </p>
        </section>

        {/* 7. Prohibited Conduct */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            7. Prohibited Conduct
          </h2>
          <p className="mt-2">You agree not to:</p>
          <ul className="mt-2 list-disc list-inside space-y-1.5">
            <li>
              Attempt to manipulate or game model rankings, ratings, or review
              scores through fake accounts, automated voting, coordinated
              campaigns, or any other deceptive means
            </li>
            <li>
              Create false, misleading, or fraudulent marketplace listings
            </li>
            <li>
              Harass, abuse, threaten, or intimidate other users of the Platform
            </li>
            <li>
              Scrape, crawl, or otherwise extract data from the Platform without
              using the authorized API
            </li>
            <li>
              Reverse engineer, decompile, or disassemble any portion of the
              Platform software or attempt to derive its source code
            </li>
            <li>
              Upload or distribute malicious code, viruses, or any content
              designed to disrupt the Platform
            </li>
            <li>
              Circumvent or attempt to circumvent rate limits, authentication
              mechanisms, or other security measures
            </li>
            <li>
              Use the Platform for any illegal purpose or in violation of
              applicable local, state, national, or international law
            </li>
            <li>
              Impersonate any person or entity, or falsely represent your
              affiliation with any person or entity
            </li>
            <li>
              Collect or harvest personal information of other users without
              their consent
            </li>
            <li>
              Interfere with the proper functioning of the Platform or impose an
              unreasonable load on our infrastructure
            </li>
          </ul>
          <p className="mt-2">
            Violation of these prohibitions may result in immediate account
            termination and, where applicable, referral to law enforcement
            authorities.
          </p>
        </section>

        {/* 8. Disclaimers */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            8. Disclaimers
          </h2>
          <p className="mt-2">
            <strong className="text-foreground">
              &quot;As Is&quot; Provision.
            </strong>{" "}
            The Platform and all content, data, and services are provided on an
            &quot;as is&quot; and &quot;as available&quot; basis without
            warranties of any kind, whether express or implied, including but
            not limited to implied warranties of merchantability, fitness for a
            particular purpose, and non-infringement.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">No Investment Advice.</strong>{" "}
            Nothing on the Platform constitutes financial, investment, legal, or
            professional advice. AI model rankings, benchmark scores, pricing
            information, and marketplace listings are provided for informational
            purposes only. You should conduct your own research and consult with
            appropriate professionals before making any decisions based on
            information from the Platform.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">
              No Guarantee of Accuracy.
            </strong>{" "}
            While we strive to provide accurate and up-to-date information, we
            do not warrant the accuracy, completeness, or reliability of any
            model rankings, benchmark data, pricing information, or other data
            displayed on the Platform. Model data is aggregated from third-party
            sources and may contain errors, delays, or omissions.
          </p>
        </section>

        {/* 9. Limitation of Liability */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            9. Limitation of Liability
          </h2>
          <p className="mt-2">
            <strong className="text-foreground">
              No Indirect Damages.
            </strong>{" "}
            To the maximum extent permitted by applicable law, AI Market Cap and
            its officers, directors, employees, and agents shall not be liable
            for any indirect, incidental, special, consequential, or punitive
            damages, or any loss of profits, data, use, or goodwill, arising out
            of or in connection with your use of the Platform, whether based on
            warranty, contract, tort (including negligence), or any other legal
            theory, even if we have been advised of the possibility of such
            damages.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">
              Aggregate Liability Limited.
            </strong>{" "}
            In no event shall our total aggregate liability exceed the greater of
            one hundred US dollars (USD $100) or the amount you have paid us in
            the twelve (12) months preceding the event giving rise to the claim.
          </p>
        </section>

        {/* 10. Modifications to Terms */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            10. Modifications to Terms
          </h2>
          <p className="mt-2">
            We reserve the right to modify these Terms at any time. For material
            changes, we will provide at least 30 days&apos; advance notice by
            updating the &quot;Last updated&quot; date at the top of this page
            and providing additional notice (such as a banner on the Platform or
            an email to registered users). Non-material changes take effect upon
            posting.
          </p>
          <p className="mt-2">
            Your continued use of the Platform after the notice period for any
            modifications to these Terms constitutes your acceptance of the
            revised Terms. If you do not agree with the modified Terms, you must
            stop using the Platform and may request deletion of your account.
          </p>
        </section>

        {/* 11. Governing Law */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            11. Governing Law &amp; Jurisdiction
          </h2>
          <p className="mt-2">
            These Terms shall be governed by and construed in accordance with
            applicable laws, without regard to conflict of law principles. Any
            disputes arising from or relating to these Terms or your use of the
            Platform shall be subject to the exclusive jurisdiction of the
            courts in the jurisdiction in which AI Market Cap operates.
          </p>
          <p className="mt-2">
            You agree to waive any right to a jury trial in connection with any
            action or litigation arising out of these Terms. Any claim arising
            out of or related to these Terms must be filed within one (1) year
            after the cause of action arose, or be forever barred.
          </p>
        </section>

        {/* 12. Contact Information */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            12. Contact Information
          </h2>
          <p className="mt-2">
            If you have any questions about these Terms of Service, please
            contact us at{" "}
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
            . We will make reasonable efforts to respond to your inquiries in a
            timely manner.
          </p>
        </section>
      </div>
    </div>
  );
}
