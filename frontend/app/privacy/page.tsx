import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
      <Link href="/" style={{ display: 'inline-block', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        ← Back
      </Link>
      <h1 style={{ marginBottom: '0.5rem' }}>Privacy Policy</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Last updated: March 7, 2025
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>1. Who We Are</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          GetawayGather is operated by Nankervis Digital LLC (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). We are the data
          controller for the personal information we collect through the Service. This Privacy Policy
          describes how we collect, use, disclose, and protect your information when you use GetawayGather.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>2. Information We Collect</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          <strong>Account and profile information.</strong> When you sign up via Google OAuth or email, we
          collect your email address, name, and profile picture (from your OAuth provider). We store when you
          accepted our Terms of Service and Privacy Policy. For first-time users, we ask you to confirm your
          age (you must be 16+); we record when you verified your age but do not store your exact age or
          date of birth.
        </p>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          <strong>Content you create.</strong> We store the lists you create, getaway data you add or that we
          extract on your behalf, notes (on lists and individual getaways), votes you cast on getaways and
          lists, and images you upload. Notes and votes are associated with your account and may be visible
          to other users who collaborate on the same list.
        </p>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          <strong>Technical and usage data.</strong> We automatically collect information necessary to operate
          the Service, including IP address, browser type, device information, and general usage data (e.g.,
          pages visited, actions taken). We use this to maintain security, debug issues, and improve the
          Service.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>3. How We Use Your Information</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          We use your information to:
        </p>
        <ul style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem', paddingLeft: '1.5rem' }}>
          <li>Provide, maintain, and improve the Service</li>
          <li>Authenticate you and manage your account</li>
          <li>Display your name and profile picture to collaborators on shared lists</li>
          <li>Display your votes and notes to collaborators on the same list (so the group can see preferences and feedback)</li>
          <li>Enforce access policies and protect the Service</li>
          <li>Respond to your requests and support inquiries</li>
          <li>Comply with legal obligations and protect our rights</li>
        </ul>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          We do not sell your personal information. We do not use your data for advertising or marketing
          purposes beyond what is necessary to operate the Service.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>4. Legal Basis for Processing (GDPR)</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          If you are in the European Economic Area or UK, we process your personal data based on: (a) your
          consent (e.g., when you accept our Terms and Privacy Policy); (b) performance of our contract with
          you (providing the Service); (c) our legitimate interests (security, improving the Service,
          enforcing our policies); and (d) legal obligations where applicable.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>5. Sharing and Disclosure</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          <strong>With other users.</strong> Your name and profile picture are visible to users who share a
          list with you. Content within shared lists (getaways, notes, votes, images) is visible to all
          collaborators on that list. Your votes and notes are attributed to you so collaborators can see who
          contributed them.
        </p>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          <strong>With service providers.</strong> We use third-party services to host and operate the
          Service. These include Supabase (database and authentication), Vercel (frontend hosting), and Railway
          (backend hosting). They process data on our behalf under data processing agreements and their
          respective privacy policies. We do not share your data with advertisers or data brokers.
        </p>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          <strong>For legal reasons.</strong> We may disclose your information if required by law, court order,
          or government request, or to protect our rights, safety, or property.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>6. International Transfers</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          Your data may be processed in the United States or other countries where our service providers
          operate. If you are in the EEA or UK, we rely on appropriate safeguards (such as Standard
          Contractual Clauses) for transfers. By using the Service, you consent to such transfers.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>7. Data Retention</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          We retain your data for as long as your account is active. If you request account deletion, we will
          delete or anonymize your personal data within a reasonable period, except where we must retain it
          for legal, regulatory, or legitimate business purposes. You may request deletion by contacting us
          at{' '}
          <a href="mailto:ethan@nankervisdigital.com" style={{ color: 'var(--accent)' }}>ethan@nankervisdigital.com</a>.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>8. Security</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          We use industry-standard measures to protect your data, including encryption in transit (HTTPS)
          and at rest, secure authentication via Supabase Auth, and access controls. No system is completely
          secure; we cannot guarantee absolute security.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>9. Cookies and Similar Technologies</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          We use essential cookies and local storage to keep you signed in and to store preferences. We do
          not use advertising or tracking cookies. Our hosting and analytics providers may set cookies
          necessary for the operation of the Service.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>10. Your Rights</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          Depending on your location, you may have the right to:
        </p>
        <ul style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem', paddingLeft: '1.5rem' }}>
          <li><strong>Access</strong> — request a copy of your personal data</li>
          <li><strong>Correction</strong> — request correction of inaccurate data</li>
          <li><strong>Deletion</strong> — request deletion of your personal data</li>
          <li><strong>Portability</strong> — receive your data in a structured, machine-readable format</li>
          <li><strong>Object or restrict</strong> — object to processing or request restriction (where applicable)</li>
          <li><strong>Withdraw consent</strong> — withdraw consent where we rely on it</li>
        </ul>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          To exercise these rights, contact us at{' '}
          <a href="mailto:ethan@nankervisdigital.com" style={{ color: 'var(--accent)' }}>ethan@nankervisdigital.com</a>.
          If you are in the EEA or UK, you may also lodge a complaint with your local data protection
          authority.
        </p>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          <strong>California residents:</strong> We do not sell or share personal information as defined
          under the CCPA. You have the right to know what we collect, to delete your data, and to
          non-discrimination for exercising your rights.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>11. Children</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          The Service is not intended for users under 16. We do not knowingly collect personal information
          from users under 16. If you believe we have collected data from someone under 16, please contact us
          and we will delete it promptly.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>12. Changes to This Policy</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          We may update this Privacy Policy from time to time. We will post the updated policy and change the
          &quot;Last updated&quot; date. For material changes, we may require you to re-accept the policy. We
          encourage you to review this policy periodically.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>13. Contact</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          Questions about this Privacy Policy or our data practices may be directed to Nankervis Digital LLC at{' '}
          <a href="mailto:ethan@nankervisdigital.com" style={{ color: 'var(--accent)' }}>ethan@nankervisdigital.com</a>.
        </p>
      </section>
    </div>
  )
}
