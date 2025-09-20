// app/page.js
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import styles from './page.module.css';

export default function LandingPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        Lexi <span>सिंपलीफाई</span>
      </h1>
      <p className={styles.subtitle}>
        Stop guessing. Understand any legal document in minutes.
        Upload your agreement, contract, or notice and get a simple, clear explanation.
      </p>
      <Link href="/dashboard" className={styles.ctaButton}>
        Get Started for Free
        <ArrowRight className={styles.ctaIcon} size={20} />
      </Link>
    </div>
  );
}