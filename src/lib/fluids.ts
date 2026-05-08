export interface BaseFluid {
  value: string;
  label: string;
  dextrose: number; // % w/v
  nacl: number;     // % w/v
}

// Reference NaCl concentrations:
// NSS = 0.9, N/2 = 0.45, N/3 = 0.3, N/4 = 0.225, Sterile Water/D5W/D10W = 0
export const BASE_FLUIDS: BaseFluid[] = [
  { value: "NSS",          label: "NSS (0.9% NaCl)",                dextrose: 0,  nacl: 0.9 },
  { value: "Sterile Water",label: "Sterile Water",                  dextrose: 0,  nacl: 0 },
  { value: "DN/2",         label: "DN/2 (5% Dextrose, 0.45% NaCl)", dextrose: 5,  nacl: 0.45 },
  { value: "D5W",          label: "D5W (5% Dextrose)",              dextrose: 5,  nacl: 0 },
  { value: "D5S",          label: "D5S (5% Dextrose, 0.9% NaCl)",   dextrose: 5,  nacl: 0.9 },
  { value: "D5N/2",        label: "D5N/2 (5% Dextrose, 0.45% NaCl)",dextrose: 5,  nacl: 0.45 },
  { value: "D5N/3",        label: "D5N/3 (5% Dextrose, 0.3% NaCl)", dextrose: 5,  nacl: 0.3 },
  { value: "D5N/4",        label: "D5N/4 (5% Dextrose, 0.225% NaCl)",dextrose:5,  nacl: 0.225 },
  { value: "D10W",         label: "D10W (10% Dextrose)",            dextrose: 10, nacl: 0 },
  { value: "D10N/2",       label: "D10N/2 (10% Dextrose, 0.45% NaCl)",dextrose:10, nacl: 0.45 },
];

export interface Additive {
  value: string;
  label: string;
  type: "dextrose" | "nacl";
  percent: number;
  vialSize: number; // ml
}

export const ADDITIVES: Additive[] = [
  { value: "D50",   label: "50% Dextrose (50 ml/vial)", type: "dextrose", percent: 50, vialSize: 50 },
  { value: "NaCl3", label: "3% NaCl (100 ml/vial)",     type: "nacl",     percent: 3,  vialSize: 100 },
];

// Diluents for dilution (lowering concentration)
export const DILUENTS = [
  { value: "Sterile Water", label: "Sterile Water", nacl: 0, dextrose: 0 },
  { value: "NSS",           label: "NSS (0.9% NaCl)",nacl: 0.9, dextrose: 0 },
];
