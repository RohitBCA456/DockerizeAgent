import React, { useState } from 'react';
import Button from './ui/Button';
import Card from './ui/Card';
import Spinner from './ui/Spinner';
import { api } from '../api';

const ExtrasView = () => {
  const [repoPath, setRepoPath] = useState(localStorage.getItem('repoPath') || '');
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleExportReports = async () => {
    if (!repoPath) return setMsg('Select a repository first');
    setExporting(true);
    setMsg(null);
    try {
      const resp = await api.generateDevops(repoPath); // this will create infra files
      setMsg('✅ Reports and infra files generated into infra/');
    } catch (e) {
      setMsg(`❌ ${e.message}`);
    }
    setExporting(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Extras & Utilities</h1>
      <p className="text-gray-400">Additional tools to export reports, quick health checks and visual helpers.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-bold text-white mb-4">Export Reports & Infra</h3>
          <p className="text-gray-300 mb-4">Runs generation and writes files into the selected repository's infra/ folder.</p>
          <div className="flex items-center space-x-3">
            <input value={repoPath} onChange={(e)=>{ setRepoPath(e.target.value); localStorage.setItem('repoPath', e.target.value); }} placeholder="Absolute repo path" className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white" />
            <Button onClick={handleExportReports} variant="primary" disabled={exporting}>{exporting ? <Spinner size="sm" /> : 'Export Now'}</Button>
            <div className="text-sm text-gray-300">{msg}</div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-bold text-white mb-4">Quick Health Check</h3>
          <p className="text-gray-300 mb-4">Run a quick health check to check ports and maintenance status.</p>
          <div className="flex items-center space-x-3">
            <Button onClick={async () => {
              if (!repoPath) return setMsg('Select a repository first');
              setMsg('Running quick health...');
              try {
                const res = await api.quickHealth(repoPath);
                const svcCount = Object.keys(res.maintenance || {}).length;
                const portCount = res.portChecks?.length || 0;
                setMsg(`Quick health complete — services: ${svcCount}, portChecks: ${portCount}`);
                console.log(res);
              } catch (e) {
                const details = e.response?.data?.error || e.message;
                setMsg(`Quick health failed: ${details}`);
              }
            }} variant="secondary">Run Quick Health</Button>
          </div>
        </Card>
      </div>

    </div>
  );
};

export default ExtrasView;
