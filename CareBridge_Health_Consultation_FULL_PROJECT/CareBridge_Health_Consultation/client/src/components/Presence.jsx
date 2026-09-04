import React from "react";

export default function Presence({ person, className = "" }) {
  const on = person?.available !== false;
  return (
    <span className={`presence ${on ? "on" : "off"} ${className}`.trim()}>
      <i />
      {on ? "Available" : "Busy"}
    </span>
  );
}
