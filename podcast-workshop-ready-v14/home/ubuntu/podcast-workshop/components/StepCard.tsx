import React from 'react';
import { CheckCircle2, LucideIcon } from 'lucide-react';

interface StepCardProps {
  stepNumber: number;
  title: string;
  description?: string;
  isActive: boolean;
  isCompleted: boolean;
  icon: LucideIcon;
  children: React.ReactNode;
  onClick?: () => void;
}

const StepCard: React.FC<StepCardProps> = ({
  stepNumber,
  title,
  description,
  isActive,
  isCompleted,
  icon: Icon,
  children,
  onClick
}) => {
  return (
    <div 
      className={`rounded-3xl transition-all duration-500 mb-6 overflow-hidden relative ${
        isActive 
          ? 'bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-orange-100 scale-[1.01]' 
          : 'bg-white/60 hover:bg-white hover:shadow-md border border-transparent hover:border-orange-100/50'
      }`}
    >
      {/* Decorative active bar */}
      {isActive && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-400"></div>}

      <div 
        className={`p-6 flex items-center cursor-pointer transition-colors ${isActive ? 'bg-white' : ''}`}
        onClick={onClick}
      >
        <div className="mr-5 flex-shrink-0 relative">
          {isCompleted ? (
            <CheckCircle2 className="w-10 h-10 text-green-500 drop-shadow-sm" />
          ) : (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-serif font-bold transition-colors duration-300 ${
              isActive 
                ? 'bg-orange-100 text-orange-700' 
                : 'bg-[#EBE5DE] text-[#8C7E72]'
            }`}>
              {stepNumber}
            </div>
          )}
        </div>
        
        <div className="flex-grow">
          <h3 className={`text-xl font-serif font-bold transition-colors ${
            isActive ? 'text-[#2C241B]' : 'text-[#8C7E72]'
          }`}>
            {title}
          </h3>
          {description && (
            <p className={`text-sm mt-1 transition-colors ${
              isActive ? 'text-[#8C7E72]' : 'text-[#B0A69C]'
            }`}>
              {description}
            </p>
          )}
        </div>
        
        <div className="ml-4 opacity-80">
          <Icon className={`w-6 h-6 transition-colors duration-300 ${
            isActive ? 'text-orange-400' : 'text-[#D6CEC5]'
          }`} />
        </div>
      </div>
      
      {/* Content Area */}
      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${
        isActive ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="p-6 pt-0 pl-[4.5rem] pr-8 pb-8">
           <div className="w-full h-px bg-gradient-to-r from-orange-100/50 to-transparent mb-6"></div>
           {children}
        </div>
      </div>
    </div>
  );
};

export default StepCard;