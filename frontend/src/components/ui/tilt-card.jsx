"use client";

import React, { useRef, useState } from "react";

export function TiltCard({ children, className = "", maxTilt = 12, ...props }) {
  const cardRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [style, setStyle] = useState({
    transform:
      "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
    transition: "transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)",
  });

  const handleMouseMove = (e) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Mouse position relative to the card's top-left corner
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setMousePos({ x: mouseX, y: mouseY });

    // Normalize to range [-0.5, 0.5]
    const relativeX = mouseX / width - 0.5;
    const relativeY = mouseY / height - 0.5;

    // Calculate rotation angles (maxTilt degrees max)
    const rotateX = -relativeY * maxTilt;
    const rotateY = relativeX * maxTilt;

    setStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
      transition: "transform 0.1s cubic-bezier(0.25, 1, 0.5, 1)",
      transformStyle: "preserve-3d",
    });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    setStyle((prev) => ({
      ...prev,
      transition: "transform 0.1s cubic-bezier(0.25, 1, 0.5, 1)",
    }));
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setStyle({
      transform:
        "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
      transition: "transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)",
      transformStyle: "preserve-3d",
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={style}
      className={`relative overflow-hidden ${className}`}
      {...props}
    >
      {/* Spotlight/Glow Effect */}
      <div
        className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(200px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.15), transparent 80%)`,
        }}
      />
      {children}
    </div>
  );
}
