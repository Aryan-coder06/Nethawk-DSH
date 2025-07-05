// client/src/components/ui/CardStat.tsx
import React from "react";

interface CardStatProps {
  label: string;
  value: string | number;
  unit?: string;
  className?: string;
}

const CardStat: React.FC<CardStatProps> = ({
  label,
  value,
  unit = "",
  className = "",
}) => (
  <div
    className={`bg-gray-800 text-white rounded-lg shadow p-4 flex flex-col items-center ${className}`}
  >
    <span className="text-sm text-gray-400">{label}</span>
    <span className="text-2xl font-bold">
      {value}
      {unit}
    </span>
  </div>
);

export default CardStat;
