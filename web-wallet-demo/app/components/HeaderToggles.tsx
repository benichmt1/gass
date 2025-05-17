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
  setDebugMode: () => {},
  simulationMode: false,
  setSimulationMode: () => {},
});

// Provider component for toggles
export function TogglesProvider({ children }: { children: React.ReactNode }) {
  // Try to get initial values from localStorage
  const getInitialValue = (key: string): boolean => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : false;
    }
    return false;
  };

  const [debugMode, setDebugModeState] = useState<boolean>(getInitialValue('debugMode'));
  const [simulationMode, setSimulationModeState] = useState<boolean>(getInitialValue('simulationMode'));

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
        className={`gass-button ${debugMode ? 'gass-button-primary' : 'gass-button-outline'}`}
        onClick={toggleDebugMode}
      >
        Debug Mode {debugMode ? 'ON' : 'OFF'}
      </button>
      <button
        className={`gass-button ${simulationMode ? 'gass-button-primary' : 'gass-button-outline'}`}
        onClick={toggleSimulationMode}
      >
        Simulation Mode {simulationMode ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}
