"use client";

import { useState, useEffect } from "react";

export function CountdownTimer({ lockDate }: { lockDate: string }) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(lockDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeLeft(lockDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockDate]);

  if (timeLeft.total <= 0) {
    return <div className="text-2xl font-bold text-red-600">Locked</div>;
  }

  return (
    <div className="text-2xl font-bold tabular-nums">
      {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m
    </div>
  );
}

function getTimeLeft(lockDate: string) {
  const total = new Date(lockDate).getTime() - Date.now();
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((total / (1000 * 60)) % 60);
  return { total, days, hours, minutes };
}
