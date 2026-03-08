import Link from 'next/link'

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
      <Link href="/" style={{ display: 'inline-block', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        ← Back
      </Link>
      <h1 style={{ marginBottom: '0.5rem' }}>Terms of Service</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Last updated: March 7, 2025
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>1. Agreement</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          By accessing or using GetawayGather (&quot;the Service&quot;), offered by Nankervis Digital LLC
          (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), you agree to be bound by these Terms of Service and our{' '}
          <Link href="/privacy">Privacy Policy</Link>. If you do not agree, do not use the Service.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>2. Eligibility</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          You must be at least 16 years old to use the Service. We reserve the right to restrict or deny
          access at our discretion.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>3. Description of Service</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          GetawayGather is a collaborative getaway research platform. You can create lists, collect getaway listings
          (including data extracted from external sources), add notes and images, and share lists with other
          invited users. The Service includes features such as voting on getaways and lists (e.g., to indicate
          preferences or rankings) and note taking on lists and individual getaways. The Service may use automated
          tools to extract and structure getaway information. We reserve the right to modify, suspend, or
          discontinue any part of the Service at any time.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>4. Account and Security</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          You are responsible for maintaining the confidentiality of your account credentials and for all
          activity under your account. You must notify us promptly of any unauthorized access. We process
          your data as described in our <Link href="/privacy">Privacy Policy</Link>. By using the Service, you
          consent to that processing.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>5. User Content and License</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          You retain ownership of content you create (lists, notes on lists and getaways, votes, uploaded images).
          By submitting content, you grant us a non-exclusive, royalty-free license to store, process, and
          display that content as necessary to operate the Service and to make it available to collaborators
          you choose. Votes and notes you add are associated with your account and may be visible to other
          collaborators on the same list. You represent that you have the right to grant this license and that
          your content does not infringe any third-party rights.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>6. Acceptable Use</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          You agree to use the Service only for lawful purposes. You may not:
        </p>
        <ul style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem', paddingLeft: '1.5rem' }}>
          <li>Violate any applicable laws or regulations</li>
          <li>Infringe on intellectual property, privacy, or other rights of others</li>
          <li>Upload or share content that is harmful, offensive, defamatory, or fraudulent</li>
          <li>Attempt to gain unauthorized access to the Service, other accounts, or our systems</li>
          <li>Use the Service to distribute malware, spam, or unsolicited communications</li>
          <li>Reverse engineer, scrape, or automate access beyond normal use</li>
          <li>Manipulate voting (e.g., using multiple accounts or automated means to influence votes)</li>
        </ul>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          We reserve the right to suspend or terminate your access for any violation of these terms.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>7. Third-Party Services</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          The Service relies on third-party providers (e.g., Supabase, Vercel, Railway) for hosting,
          authentication, and infrastructure. Getaway data may be sourced from external websites. We are not
          responsible for the availability, accuracy, or practices of these third parties. Your use of their
          services may be subject to their own terms and policies.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>8. Disclaimer of Warranties</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or
          implied. We do not guarantee the accuracy, completeness, or reliability of getaway data, including
          data extracted from external sources. We are not liable for any decisions you make based on
          information obtained through the Service.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>9. Limitation of Liability</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          To the maximum extent permitted by law, Nankervis Digital LLC and its officers, directors, and
          affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive
          damages, or any loss of profits, data, or goodwill, arising from your use of the Service. Our total
          liability for any claims related to the Service shall not exceed the amount you paid us in the twelve
          months preceding the claim (or $100 if you have not paid us). Some jurisdictions do not allow these
          limitations; in such cases, our liability is limited to the fullest extent permitted by law.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>10. Indemnification</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          You agree to indemnify and hold harmless Nankervis Digital LLC and its officers, directors, and
          affiliates from any claims, damages, losses, or expenses (including reasonable attorneys&apos; fees)
          arising from your use of the Service, your content, or your violation of these Terms.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>11. Termination</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          We may suspend or terminate your access at any time, with or without cause or notice. You may stop
          using the Service at any time. Upon termination, your right to use the Service ceases immediately.
          Sections that by their nature should survive (including 8, 9, 10, and 12) will survive termination.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>12. Changes to Terms</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          We may update these Terms from time to time. We will notify you of material changes by posting the
          updated Terms and updating the &quot;Last updated&quot; date. If we make material changes, we may also
          require you to re-accept the Terms. Continued use of the Service after changes constitutes
          acceptance. If you do not agree to the updated Terms, you must stop using the Service.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>13. General</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          These Terms constitute the entire agreement between you and Nankervis Digital LLC regarding the
          Service. If any provision is found unenforceable, the remaining provisions will remain in effect.
          Our failure to enforce any right does not waive that right. These Terms are governed by the laws of
          the State of Delaware, without regard to conflict of law principles.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>14. Contact</h2>
        <p style={{ color: 'var(--light)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          Questions about these Terms may be directed to Nankervis Digital LLC at{' '}
          <a href="mailto:ethan@nankervisdigital.com" style={{ color: 'var(--accent)' }}>ethan@nankervisdigital.com</a>.
        </p>
      </section>
    </div>
  )
}
