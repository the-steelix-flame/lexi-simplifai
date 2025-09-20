// app/api/history/route.js
import { NextResponse } from 'next/server';
import { getClients } from '@/lib/server-clients'; // Import our central helper

export async function GET(request) {
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
    const snapshot = await analysesRef.orderBy('createdAt', 'desc').get();

    if (snapshot.empty) {
      return NextResponse.json([]);
    }

    const history = [];
    snapshot.forEach(doc => {
      history.push({ id: doc.id, ...doc.data() });
    });

    return NextResponse.json(history);

  } catch (error) {
    console.error("🔥🔥🔥 CRITICAL ERROR in history API:", error);
    return NextResponse.json({ error: 'Failed to fetch history.' }, { status: 500 });
  }
}