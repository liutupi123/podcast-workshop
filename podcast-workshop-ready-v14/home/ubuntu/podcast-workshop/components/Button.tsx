import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md';
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  isLoading, 
  variant = 'primary', 
  size = 'md',
  className = '', 
  disabled,
  ...props 
}) => {
  // Base styles: Rounded-full for friendlier feel
  const baseStyles = "rounded-full font-medium transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-1 active:scale-95";
  
  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-6 py-2.5 text-sm"
  };

  const variants = {
    // Primary: Dark Coffee -> Lighter Coffee
    primary: "bg-[#2C241B] text-[#EBE5DE] hover:bg-[#45382c] hover:shadow-lg focus:ring-[#2C241B] disabled:bg-[#8C7E72]",
    // Secondary: Soft Orange/Amber
    secondary: "bg-orange-100 text-orange-800 hover:bg-orange-200 hover:text-orange-900 focus:ring-orange-200 border border-orange-200",
    // Outline: Soft borders
    outline: "border border-[#D6CEC5] text-[#4A4036] hover:bg-[#FAF9F6] hover:border-[#8C7E72] hover:text-[#2C241B] focus:ring-[#8C7E72] bg-transparent"
  };

  return (
    <button 
      className={`${baseStyles} ${sizeStyles[size]} ${variants[variant]} ${className} ${isLoading ? 'cursor-not-allowed opacity-80' : ''}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};

export default Button;