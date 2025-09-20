// app/dashboard/page.js
"use client";

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { auth, db } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { UploadCloud, FileText, LogOut, Loader2, AlertTriangle, Languages, History, Download, Settings, Sun, Moon, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import styles from './dashboard.module.css';

// --- Reusable Components ---

// Jargon Highlighting Component with Tooltip
const HighlightedSummary = ({ summary, jargon }) => {
  const [tooltip, setTooltip] = useState({ visible: false, content: '', x: 0, y: 0 });

  const handleMouseOver = (explanation, e) => {
    setTooltip({ visible: true, content: explanation, x: e.clientX, y: e.clientY });
  };

  const handleMouseOut = () => {
    setTooltip({ visible: false, content: '', x: 0, y: 0 });
  };
  
  const getHighlightedText = () => {
    if (!jargon || jargon.length === 0) {
      return summary;
    }
    const regex = new RegExp(`\\b(${jargon.map(j => j.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
    const parts = summary.split(regex);
    
    return parts.map((part, index) => {
      const match = jargon.find(j => j.term.toLowerCase() === part.toLowerCase());
      if (match) {
        return (
          <span
            key={index}
            className={styles.jargonHighlight}
            onMouseOver={(e) => handleMouseOver(match.explanation, e)}
            onMouseOut={handleMouseOut}
            onMouseMove={(e) => handleMouseOver(match.explanation, e)}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      {tooltip.visible && (
        <div className={styles.tooltip} style={{ top: tooltip.y + 20, left: tooltip.x + 20 }}>
          {tooltip.content}
        </div>
      )}
      <p className={styles.summaryText}>{getHighlightedText()}</p>
    </div>
  );
};

// --- Main Dashboard Page Component ---

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  // State Management
  const [file, setFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard', 'history', 'settings'
  
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  
  const [pastAnalyses, setPastAnalyses] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  // --- Data Fetching ---
  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setIsLoadingHistory(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/history', {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) throw new Error('Could not fetch document history.');
      const data = await response.json();
      setPastAnalyses(data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchHistory();
    } else {
      setPastAnalyses([]); // Clear history on sign out
    }
  }, [user, fetchHistory]);

  // --- Core Functions ---
  const handleAnalyze = async () => {
    if (!file) return toast.error('Please upload a file first.');
    if (!user) { handleSignIn(); return; }
    
    setIsAnalyzing(true);
    setCurrentAnalysis(null);
    const toastId = toast.loading(`Analyzing & Translating...`);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', selectedLanguage);

    try {
      const response = await fetch('/api/analyze', { method: 'POST', body: formData });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Analysis failed.');
      }
      
      const data = await response.json();
      setCurrentAnalysis({ fileName: file.name, ...data });
      setActiveTab('summary');
      toast.success('Analysis complete!', { id: toastId });

      const docRef = doc(db, 'users', user.uid, 'analyses', `analysis_${Date.now()}`);
      await setDoc(docRef, { fileName: file.name, ...data, createdAt: new Date() });
      await fetchHistory();

    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!qaQuestion.trim()) return toast.error('Please enter a question.');
    if (!currentAnalysis?.summary) return toast.error('Please analyze or select a document first.');

    setIsAsking(true);
    setQaAnswer('');
    const toastId = toast.loading('Finding answer...');

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: currentAnalysis.summary, question: qaQuestion }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to get an answer.');
      }
      
      const data = await response.json();
      setQaAnswer(data.answer);
      toast.success('Answer found!', { id: toastId });

    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setIsAsking(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!currentAnalysis) return;
    const doc = new jsPDF();
    const { category, summary, risks, fileName } = currentAnalysis;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(`Analysis for: ${fileName}`, 14, 22);

    doc.setFontSize(14);
    doc.text(`Category: ${category}`, 14, 32);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Summary", 14, 45);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const summaryLines = doc.splitTextToSize(summary, 180);
    doc.text(summaryLines, 14, 52);
    
    let yPos = 52 + (summaryLines.length * 5) + 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Risks & Obligations", 14, yPos);
    yPos += 7;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    risks.forEach(risk => {
        const riskLines = doc.splitTextToSize(risk, 175);
        doc.text(`•`, 16, yPos);
        doc.text(riskLines, 20, yPos);
        yPos += (riskLines.length * 5) + 2;
    });

    doc.save(`LexiSimplify_Summary_${fileName.replace(/\.[^/.]+$/, "")}.pdf`);
  };

  const handleViewAnalysis = (analysis) => {
    setCurrentAnalysis(analysis);
    setActiveView('dashboard');
    setFile({name: analysis.fileName});
    setActiveTab('summary');
    setQaQuestion('');
    setQaAnswer('');
  };

  const handleClearHistory = async () => {
    if (!user) return;
    if (window.confirm("Are you sure you want to delete all your document analyses? This action cannot be undone.")) {
      const toastId = toast.loading('Clearing history...');
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/history/clear', {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) throw new Error('Failed to clear history.');
        
        setPastAnalyses([]);
        toast.success('History cleared!', { id: toastId });
      } catch (error) {
        toast.error(error.message, { id: toastId });
      }
    }
  };

  // --- Authentication & File Drop ---
  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success('Signed in successfully!');
    } catch (error) {
      toast.error('Failed to sign in.');
    }
  };
  
  const handleSignOut = async () => {
    await signOut(auth);
    setCurrentAnalysis(null);
    setFile(null);
    setActiveView('dashboard');
    toast.success('Signed out.');
  };

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles[0]) {
      setFile(acceptedFiles[0]);
      setCurrentAnalysis(null);
      setActiveView('dashboard');
    }
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpeg', '.jpg', '.png'] },
    multiple: false,
  });

  return (
    <div className={styles.layout}>
      <nav className={styles.sidebar}>
        <div className={styles.logo}>
          <FileText size={32} />
          <span>Lexi सिंपलीफाई</span>
        </div>
        <ul className={styles.navList}>
          <li className={`${styles.navItem} ${activeView === 'dashboard' ? styles.navItemActive : ''}`} onClick={() => setActiveView('dashboard')}>
            <UploadCloud size={20}/> New Analysis
          </li>
          <li className={`${styles.navItem} ${activeView === 'history' ? styles.navItemActive : ''}`} onClick={() => setActiveView('history')}>
            <History size={20}/> My Documents
          </li>
        </ul>
        <div className={styles.navFooter}>
          <div className={`${styles.navItem} ${activeView === 'settings' ? styles.navItemActive : ''}`} onClick={() => setActiveView('settings')}>
            <Settings size={20}/> Settings
          </div>
        </div>
      </nav>

      <main className={styles.mainContent}>
        <header className={styles.header}>
            <h1 className={styles.headerTitle}>
              {activeView === 'dashboard' && 'New Analysis'}
              {activeView === 'history' && 'My Documents'}
              {activeView === 'settings' && 'Settings'}
            </h1>
            <div className={styles.authSection}>
              {loading ? <div/> : user ? (
                <div className={styles.userInfo}>
                  {/* ✅ FIX 2: Replaced <img> with <Image> for optimization */}
                  <Image 
                    src={user.photoURL} 
                    alt={user.displayName}
                    width={40}
                    height={40}
                    className={styles.userAvatar} 
                  />
                  <span>{user.displayName}</span>
                  <button onClick={handleSignOut} className={styles.signOutButton} title="Sign Out">
                    <LogOut size={20} />
                  </button>
                </div>
              ) : (
                <button onClick={handleSignIn} className={styles.signInButton}>Sign In with Google</button>
              )}
            </div>
        </header>

        {activeView === 'dashboard' && (
          <>
            <div className={styles.uploadArea}>
              <div {...getRootProps()} className={`${styles.dropzone} ${isDragActive ? styles.dropzoneActive : ''}`}>
                <input {...getInputProps()} />
                <UploadCloud size={48} color="#9ca3af" />
                {file ? ( <p>Selected: <strong>{file.name}</strong></p> ) : ( <p>Drag & drop PDF or Image here, or click to select</p> )}
              </div>
              <div className={styles.controls}>
                <div className={styles.languageSelector}>
                  <Languages size={20} />
                  <select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)}>
                    <option>English</option>
                    <option>Hindi</option>
                    <option>Tamil</option>
                    <option>Bengali</option>
                    <option>Spanish</option>
                    <option>French</option>
                  </select>
                </div>
                <button onClick={handleAnalyze} disabled={isAnalyzing || !file} className={styles.analyzeButton}>
                  {isAnalyzing && <Loader2 className={styles.loader} />}
                  {isAnalyzing ? 'Analyzing...' : 'Simplify Document'}
                </button>
              </div>
            </div>
            
            {isAnalyzing && (
                <div className={styles.loaderContainer}>
                    <Loader2 className={styles.loader} size={48} />
                    <p>Please wait, this can take up to a minute...</p>
                </div>
            )}
            
            {currentAnalysis && !isAnalyzing && (
              <div className={styles.resultsContainer}>
                <div className={styles.resultsHeader}>
                  <h2>{currentAnalysis.category}</h2>
                  <p>File: {currentAnalysis.fileName}</p>
                  <button onClick={handleDownloadPDF} className={styles.downloadButton}>
                    <Download size={16}/> Download PDF
                  </button>
                </div>
                <div className={styles.tabs}>
                  <button onClick={() => setActiveTab('summary')} className={`${styles.tabButton} ${activeTab === 'summary' ? styles.tabButtonActive : ''}`}>Summary</button>
                  <button onClick={() => setActiveTab('risks')} className={`${styles.tabButton} ${activeTab === 'risks' ? styles.tabButtonActive : ''}`}>Risks</button>
                  <button onClick={() => setActiveTab('qa')} className={`${styles.tabButton} ${activeTab === 'qa' ? styles.tabButtonActive : ''}`}>Ask Q&A</button>
                </div>
                <div className={styles.tabContent}>
                  {activeTab === 'summary' && (
                    <div className={styles.translationGrid}>
                      <div>
                        <h3 className={styles.contentTitle}>English Summary</h3>
                        <HighlightedSummary summary={currentAnalysis.summary} jargon={currentAnalysis.jargon} />
                      </div>
                      <div>
                        <h3 className={styles.contentTitle}>{currentAnalysis.translations ? selectedLanguage : ''} Summary</h3>
                        <p className={styles.summaryText}>{currentAnalysis.translations?.summary}</p>
                      </div>
                    </div>
                  )}
                  {activeTab === 'risks' && (
                    <div className={styles.translationGrid}>
                      <div>
                        <h3 className={styles.contentTitle}>English Risks & Obligations</h3>
                        <ul className={styles.riskList}>{currentAnalysis.risks?.map((risk, i) => <li key={i}><AlertTriangle size={16}/> {risk}</li>)}</ul>
                      </div>
                      <div>
                        <h3 className={styles.contentTitle}>{currentAnalysis.translations ? selectedLanguage : ''} Risks & Obligations</h3>
                        <ul className={styles.riskList}>{currentAnalysis.translations?.risks?.map((risk, i) => <li key={i}><AlertTriangle size={16}/> {risk}</li>)}</ul>
                      </div>
                    </div>
                  )}
                  {activeTab === 'qa' && (
                    <div>
                      <h3 className={styles.contentTitle}>Ask a Question About Your Document</h3>
                      <form onSubmit={handleAskQuestion} className={styles.qaForm}>
                        <input
                          type="text"
                          value={qaQuestion}
                          onChange={(e) => setQaQuestion(e.target.value)}
                          placeholder="e.g., What is my notice period?"
                          className={styles.qaInput}
                        />
                        <button type="submit" disabled={isAsking} className={styles.qaButton}>
                          {isAsking ? <Loader2 className={styles.loader}/> : 'Ask'}
                        </button>
                      </form>
                      {isAsking && <div className={styles.loaderContainer} style={{marginTop: '1rem'}}><Loader2 className={styles.loader}/></div>}
                      {qaAnswer && !isAsking && <div className={styles.qaAnswer}><p>{qaAnswer}</p></div>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {activeView === 'history' && (
          <div className={styles.historyContainer}>
            {isLoadingHistory ? <div className={styles.loaderContainer}><Loader2 className={styles.loader} size={48}/></div> : (
              pastAnalyses.length > 0 ? (
                pastAnalyses.map(item => (
                  <div key={item.id} className={styles.historyItem} onClick={() => handleViewAnalysis(item)}>
                    <FileText/>
                    <div className={styles.historyItemDetails}>
                      <strong>{item.fileName}</strong>
                      <p>Analyzed on: {new Date(item.createdAt.seconds * 1000).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))
              ) : (
                // ✅ FIX 1: Changed inner double quotes to single quotes
                <p>You have no saved analyses yet. Go to New Analysis to get started.</p>
              )
            )}
          </div>
        )}
        
        {activeView === 'settings' && (
          <div className={styles.settingsContainer}>
            <div className={styles.settingItem}>
              <h3>Appearance</h3>
              <div className={styles.settingControl}>
                <p>Switch between light and dark mode.</p>
                <button onClick={toggleTheme} className={styles.themeToggleButton}>
                  {theme === 'light' ? <Moon size={20}/> : <Sun size={20}/>}
                  Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
                </button>
              </div>
            </div>
            <div className={`${styles.settingItem} ${styles.dangerZone}`}>
              <h3>Data Management</h3>
              <div className={styles.settingControl}>
                <p>Permanently delete all of your saved document analyses.</p>
                <button onClick={handleClearHistory} className={styles.dangerButton} disabled={pastAnalyses.length === 0}>
                  <Trash2 size={20}/> Clear All Documents
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}