import React from "react";

export default function Avatar({ person, className = "" }) {
  const label = person?.avatar || (person?.name || "?").slice(0, 2).toUpperCase();
  return (
    <div className={`avatar ${className}`.trim()}>
      {person?.photo ? <img src={person.photo} alt="" /> : label}
    </div>
  );
}
