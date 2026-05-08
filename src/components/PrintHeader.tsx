import logo from "@/assets/bangkok-hospital-logo.png";

export const PrintHeader = () => (
  <div className="print-logo-header hidden print:flex">
    <img src={logo} alt="Bangkok Hospital Pattaya" />
    <div>
      <div className="hospital-name">Bangkok Hospital Pattaya</div>
      <div className="hospital-sub">Pharmacy Department · PharmCalc Pro</div>
    </div>
  </div>
);
