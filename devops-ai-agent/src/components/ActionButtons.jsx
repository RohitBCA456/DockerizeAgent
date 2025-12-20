import React from 'react';
import Button from './ui/Button';

const ActionButtons = ({ onThreat, onDR, loading }) => {
  return (
    <div className="flex items-center space-x-3 ml-2">
      <Button onClick={onThreat} disabled={loading} variant="premium" className="shadow-lg flex items-center px-6 py-2">
        ThreatModel
      </Button>
      <Button onClick={onDR} disabled={loading} variant="primary" className="shadow-lg flex items-center px-6 py-2">
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 7v10a2 2 0 0 0 2 2h14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        DRPlan
      </Button>
    </div>
  );
};

export default ActionButtons;
