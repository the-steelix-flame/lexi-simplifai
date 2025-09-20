// app/api/history/clear/route.js
import { NextResponse } from 'next/server';
import { getClients } from '@/lib/server-clients'; // Import our central helper

export async function DELETE(request) {
  try {
    // Initialize clients safely inside the request handler
    const { adminDb, adminAuth } = getClients();
    
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const analysesRef = adminDb.collection('users').doc(uid).collection('analyses');
    const snapshot = await analysesRef.get();

    if (snapshot.empty) {
      return NextResponse.json({ message: 'No documents to delete.' });
    }

    const batch = adminDb.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    return NextResponse.json({ message: 'History cleared successfully.' });

  } catch (error) {
    console.error("🔥🔥🔥 CRITICAL ERROR in clear history API:", error);
    return NextResponse.json({ error: 'Failed to clear history.' }, { status: 500 });
  }
}