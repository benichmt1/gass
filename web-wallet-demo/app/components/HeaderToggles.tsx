'use client';

import { useState, useEffect, createContext, useContext } from 'react';

// Create context for global toggles
interface TogglesContextType {
  debugMode: boolean;
  setDebugMode: (value: boolean) => void;
  simulationMode: boolean;
  setSimulationMode: (value: boolean) => void;
}

const TogglesContext = createContext<TogglesContextType>({
  debugMode: false,
  setDebugMode: () => { },
  simulationMode: false,
  setSimulationMode: () => { },
});

// Provider component for toggles
export function TogglesProvider({ children }: { children: React.ReactNode }) {
  const [debugMode, setDebugModeState] = useState<boolean>(false);
  const [simulationMode, setSimulationModeState] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedDebug = localStorage.getItem('debugMode');
      if (storedDebug) setDebugModeState(JSON.parse(storedDebug));
      
      const storedSim = localStorage.getItem('simulationMode');
      if (storedSim) setSimulationModeState(JSON.parse(storedSim));
    }
  }, []);

  // Update localStorage when values change
  const setDebugMode = (value: boolean) => {
    setDebugModeState(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('debugMode', JSON.stringify(value));
    }
  };

  const setSimulationMode = (value: boolean) => {
    setSimulationModeState(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('simulationMode', JSON.stringify(value));
    }
  };

  return (
    <TogglesContext.Provider value={{ debugMode, setDebugMode, simulationMode, setSimulationMode }}>
      {children}
    </TogglesContext.Provider>
  );
}

// Hook to use the toggles context
export const useToggles = () => useContext(TogglesContext);

// For backward compatibility with existing code
export const getDebugMode = (): boolean => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('debugMode');
    return stored ? JSON.parse(stored) : false;
  }
  return false;
};

export const getSimulationMode = (): boolean => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('simulationMode');
    return stored ? JSON.parse(stored) : false;
  }
  return false;
};

export default function HeaderToggles() {
  const { debugMode, setDebugMode, simulationMode, setSimulationMode } = useToggles();

  // Toggle debug mode without page refresh
  const toggleDebugMode = () => {
    setDebugMode(!debugMode);
  };

  // Toggle simulation mode without page refresh
  const toggleSimulationMode = () => {
    setSimulationMode(!simulationMode);
  };

  return (
    <div className="gass-toggles">
      <button
        className={`gass-button gass-button-outline ${debugMode ? 'active' : ''}`}
        onClick={toggleDebugMode}
        title={debugMode ? 'Debug Mode ON' : 'Debug Mode OFF'}
        style={{
          fontSize: '0.75rem',
          padding: '0.5rem 0.75rem',
          opacity: debugMode ? 1 : 0.6,
          background: debugMode ? 'rgba(10, 132, 255, 0.12)' : 'transparent',
          borderColor: debugMode ? 'rgba(10, 132, 255, 0.25)' : undefined,
        }}
      >
        🔧 {debugMode ? 'Debug' : 'Debug'}
      </button>
      <button
        className={`gass-button gass-button-outline ${simulationMode ? 'active' : ''}`}
        onClick={toggleSimulationMode}
        title={simulationMode ? 'Simulation Mode ON' : 'Simulation Mode OFF'}
        style={{
          fontSize: '0.75rem',
          padding: '0.5rem 0.75rem',
          opacity: simulationMode ? 1 : 0.6,
          background: simulationMode ? 'rgba(255, 149, 0, 0.15)' : 'transparent',
          borderColor: simulationMode ? 'rgba(255, 149, 0, 0.3)' : undefined,
        }}
      >
        🧪 {simulationMode ? 'Sim' : 'Sim'}
      </button>
    </div>
  );
}
