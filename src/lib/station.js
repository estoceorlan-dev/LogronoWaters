import { createContext, useContext } from "react";

export const StationContext = createContext(null);
export function useStation() {
  return useContext(StationContext);
}
