// Test component to check database state
import React, { useState, useEffect } from 'react';

export default function DatabaseDebugger() {
  const [workflows, setWorkflows] = useState([]);
  const [steps, setSteps] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const workflowsData = await window.electronAPI.invoke('db:getWorkflows');
      setWorkflows(workflowsData || []);
      
      if (workflowsData && workflowsData.length > 0) {
        const stepsData = await window.electronAPI.invoke('db:getSteps', workflowsData[0].id);
        setSteps(stepsData || []);
      }
    } catch (error) {
      console.error('Database debug error:', error);
    }
  };

  return (
    <div style={{padding: '20px', fontFamily: 'monospace'}}>
      <h2>🔍 Database Debug</h2>
      
      <h3>Workflows:</h3>
      <pre>{JSON.stringify(workflows, null, 2)}</pre>
      
      <h3>Steps:</h3>
      {steps.map(step => (
        <div key={step.id} style={{border: '1px solid #ccc', margin: '10px', padding: '10px'}}>
          <div><strong>Step {step.id}:</strong> {step.description}</div>
          <div><strong>Action:</strong> {step.action_type}</div>
          <div><strong>Config:</strong> {step.config || 'NULL'}</div>
          <div><strong>Selector:</strong> {step.selector || 'NULL'}</div>
          <div><strong>Input Data:</strong> {step.input_data || 'NULL'}</div>
        </div>
      ))}
      
      <button onClick={loadData} style={{marginTop: '20px', padding: '10px'}}>
        🔄 Reload Data
      </button>
    </div>
  );
}