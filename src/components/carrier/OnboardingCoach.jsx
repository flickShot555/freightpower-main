import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext'; // Import Auth to get token for API call
import { API_URL } from '../../config';

const OnboardingCoach = () => {
    // Initial state setup
    const { currentUser } = useAuth(); 
    const [coachData, setCoachData] = useState({
        status_color: 'Gray',
        total_score: 0,
        next_best_actions: ['Analyzing profile...'],
        fmcsa_status: 'N/A'
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        const fetchStatus = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = await currentUser.getIdToken();
                
                // Fetch data from the backend endpoint (Firebase auth compatible)
                const response = await fetch(`${API_URL}/onboarding/coach-status`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    setCoachData(data);
                } else {
                    const errData = await response.json();
                    throw new Error(errData.detail || "Failed to load coach status.");
                }
            } catch (error) {
                console.error("Coach status error:", error);
                setError(error.message);
                setCoachData({
                    status_color: 'Gray',
                    total_score: 0,
                    next_best_actions: ['Please upload a document to begin analysis.'],
                    fmcsa_status: 'N/A'
                });
            }
            setLoading(false);
        };
        
        fetchStatus();
    }, [currentUser]);

    // Helper function to map status to CSS class
    const getColorClass = (status) => {
        if (status === 'Green') return 'badge-green';
        if (status === 'Amber') return 'badge-amber';
        if (status === 'Red') return 'badge-red';
        return 'badge-gray';
    };

    return (
        <div className="onboarding-coach-card" style={{
            background: '#ffffff',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>AI Onboarding Coach</h2>
            <hr style={{ borderColor: '#eee', marginBottom: '15px' }} />
            
            {loading ? (
                <p>Analyzing profile and refreshing FMCSA data...</p>
            ) : error ? (
                <p style={{ color: 'red' }}>Error: {error}</p>
            ) : (
                <>
                    {/* Score Badge (Red/Amber/Green) */}
                    <div className={`score-badge ${getColorClass(coachData.status_color)}`} style={{
                        display: 'inline-block',
                        padding: '10px 15px',
                        fontWeight: 'bold',
                        borderRadius: '5px',
                        color: 'white',
                        minWidth: '150px',
                        textAlign: 'center',
                        background: coachData.status_color === 'Green' ? '#059669' : coachData.status_color === 'Amber' ? '#fbbf24' : '#dc2626'
                    }}>
                        Compliance Score: {coachData.total_score} / 100
                    </div>

                    <div style={{ marginTop: '15px', fontSize: '0.9rem' }}>
                        FMCSA Status: <strong>{coachData.fmcsa_status}</strong>
                    </div>

                    {/* Next Best Actions (NBA) */}
                    <h3 style={{ fontSize: '1.1rem', marginTop: '20px', marginBottom: '10px' }}>Next Steps:</h3>
                    <ul className="nba-list" style={{ listStyleType: 'disc', marginLeft: '20px', paddingLeft: '0' }}>
                        {coachData.next_best_actions.map((action, index) => (
                            <li key={index} style={{ marginBottom: '5px' }}>
                                ➡️ {action}
                            </li>
                        ))}
                    </ul>
                    
                    {coachData.is_ready && (
                        <p style={{ marginTop: '20px', color: '#059669', fontWeight: 'bold' }}>
                            You are fully compliant! Access to the Marketplace is unlocked.
                        </p>
                    )}
                </>
            )}
        </div>
    );
};

export default OnboardingCoach;