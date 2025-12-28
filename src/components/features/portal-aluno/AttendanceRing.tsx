/**
 * AttendanceRing Component
 * Visual circular progress indicator for attendance percentage
 */
import React from 'react';

interface AttendanceRingProps {
    percentage: number;
}

export const AttendanceRing: React.FC<AttendanceRingProps> = ({ percentage }) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const color = percentage >= 75 ? "text-green-500" : percentage >= 60 ? "text-yellow-500" : "text-red-500";

    return (
        <div className="relative flex items-center justify-center w-20 h-20">
            <svg className="transform -rotate-90 w-full h-full">
                <circle
                    className="text-gray-200"
                    strokeWidth="6"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="40"
                    cy="40"
                />
                <circle
                    className={`${color} transition-all duration-1000 ease-out`}
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="40"
                    cy="40"
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className={`text-sm font-bold ${color}`}>{Math.round(percentage)}%</span>
                <span className="text-[8px] text-gray-400 uppercase">Freq.</span>
            </div>
        </div>
    );
};
