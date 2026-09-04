import React, { useRef } from "react";

export function fileToPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Choose a photo."));
    if (!String(file.type || "").startsWith("image/")) return reject(new Error("Use a JPG, PNG, or WebP photo."));
    if (file.size > 8 * 1024 * 1024) return reject(new Error("Photo must be under 8 MB."));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 320;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

export default function PhotoPicker({ value, name, onChange, onError }) {
  const inputRef = useRef(null);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      onChange(await fileToPhoto(file));
    } catch (err) {
      onError?.(err.message || "Could not use that photo.");
    }
  };

  return (
    <div className="photo-picker">
      <button type="button" className={`avatar large photo-preview ${value ? "has-photo" : ""}`} onClick={() => inputRef.current?.click()}>
        {value ? <img src={value} alt="" /> : (name || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "+"}
      </button>
      <div className="grow">
        <strong>Profile photo</strong>
        <span className="muted">JPG or PNG. This picture shows on your file, the directory, and when a patient chooses a doctor.</span>
        <div className="row-actions" style={{ marginTop: 8 }}>
          <button type="button" className="secondary-btn" onClick={() => inputRef.current?.click()}>{value ? "Change photo" : "Add photo"}</button>
          {value && <button type="button" className="ghost-btn" onClick={() => onChange("")}>Remove</button>}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={pick} />
    </div>
  );
}
