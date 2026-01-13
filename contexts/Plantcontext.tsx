import { createContext, useContext, useState, ReactNode } from "react";

interface PlantContextProps {
  selectedPlant: string | null;
  setSelectedPlant: (plant: string | null) => void;
}

const PlantContext = createContext<PlantContextProps | undefined>(undefined);

export const PlantProvider = ({ children }: { children: ReactNode }) => {
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);

  return (
    <PlantContext.Provider value={{ selectedPlant, setSelectedPlant }}>
      {children}
    </PlantContext.Provider>
  );
};

export const usePlant = () => {
  const ctx = useContext(PlantContext);
  if (!ctx) throw new Error("usePlant must be used inside PlantProvider");
  return ctx;
};
